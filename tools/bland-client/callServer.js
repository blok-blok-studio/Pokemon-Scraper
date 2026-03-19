const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const Anthropic = require('@anthropic-ai/sdk');
const { createChildLogger } = require('../logger');

const log = createChildLogger('call-server');

const CLAUDE_TIMEOUT_MS = 10000;

/**
 * Creates a temporary Express + WebSocket server for handling a single
 * Twilio ↔ Deepgram ↔ Claude real-time voice call.
 *
 * Flow:
 *  1. Twilio connects via WebSocket (bidirectional media stream)
 *  2. Incoming audio → Deepgram STT (live transcription)
 *  3. Transcribed text → Claude (conversational response)
 *  4. Claude response → Deepgram TTS → audio back to Twilio
 */
function createCallServer({ script, maxDuration = 120, agentName = 'a Pokemon card collector' }) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));

  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  const anthropic = new Anthropic();

  // Conversation state
  const transcript = [];
  let streamSid = null;
  let callActive = false;
  let callEndResolve = null;
  const callEndPromise = new Promise(resolve => { callEndResolve = resolve; });
  let callTimeout = null;
  let twilioWs = null;
  let dgLive = null;
  let isProcessingResponse = false;

  // TwiML endpoint — Twilio hits this when call connects
  app.post('/twiml', (req, res) => {
    const host = req.headers.host;
    const wsUrl = `wss://${host}/media-stream`;
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}" />
  </Connect>
</Response>`);
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/media-stream' });

  wss.on('connection', (ws) => {
    log.info('Twilio media stream connected');
    twilioWs = ws;
    callActive = true;
    // Clear conversation history from any previous call on this server
    conversationHistory.length = 0;

    // Auto-hangup after maxDuration
    callTimeout = setTimeout(() => {
      log.info(`Max duration (${maxDuration}s) reached, ending call`);
      endCall();
    }, maxDuration * 1000);

    // Set up Deepgram live STT
    try {
      dgLive = deepgram.listen.live({
        model: 'nova-2',
        language: 'en-US',
        encoding: 'mulaw',
        sample_rate: 8000,
        channels: 1,
        smart_format: true,
        interim_results: false,
        utterance_end_ms: 1500,
        vad_events: true,
        endpointing: 300,
      });
    } catch (err) {
      log.error(`Failed to create Deepgram STT connection: ${err.message}`);
      endCall();
      return;
    }

    let greetingSent = false;

    dgLive.on(LiveTranscriptionEvents.Open, () => {
      log.info('Deepgram STT connection opened');

      // Send greeting once we have both STT connection and streamSid
      function trySendGreeting() {
        if (greetingSent) return;
        if (!streamSid) {
          // streamSid not yet received from Twilio — retry shortly
          setTimeout(trySendGreeting, 200);
          return;
        }
        greetingSent = true;
        sendTTSResponse(script).catch(err => {
          log.error(`Failed to send greeting TTS: ${err.message}`);
        });
        transcript.push({ role: 'agent', text: script });
      }
      trySendGreeting();
    });

    dgLive.on(LiveTranscriptionEvents.Transcript, async (data) => {
      const text = data.channel?.alternatives?.[0]?.transcript;
      if (!text || text.trim().length === 0) return;
      if (!data.is_final) return;
      if (isProcessingResponse) return; // Skip if we're still responding

      log.info(`Seller said: "${text}"`);
      transcript.push({ role: 'seller', text: text.trim() });

      // Generate Claude response
      isProcessingResponse = true;
      try {
        const response = await getClaudeResponse(text.trim());
        if (response && callActive) {
          log.info(`Agent says: "${response}"`);
          transcript.push({ role: 'agent', text: response });
          await sendTTSResponse(response);

          // If Claude signals the end of conversation, hang up after speaking
          if (response.toLowerCase().includes('thank you') && response.toLowerCase().includes('bye')) {
            setTimeout(() => endCall(), 3000);
          }
        }
      } catch (err) {
        log.error(`Response pipeline error: ${err.message}`);
        // If Claude fails, try a graceful fallback
        if (callActive) {
          try {
            await sendTTSResponse("I'm sorry, could you repeat that?");
            transcript.push({ role: 'agent', text: "I'm sorry, could you repeat that?" });
          } catch (ttsErr) {
            log.error(`Fallback TTS also failed: ${ttsErr.message}`);
            endCall();
          }
        }
      } finally {
        isProcessingResponse = false;
      }
    });

    dgLive.on(LiveTranscriptionEvents.Error, (err) => {
      log.error(`Deepgram STT error: ${err.message}`);
      // If STT drops, end the call gracefully
      if (callActive) {
        log.warn('Deepgram STT connection lost, ending call');
        endCall();
      }
    });

    dgLive.on(LiveTranscriptionEvents.Close, () => {
      log.info('Deepgram STT connection closed');
    });

    // Handle Twilio WebSocket messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);

        switch (data.event) {
          case 'connected':
            log.info('Twilio stream connected');
            break;

          case 'start':
            streamSid = data.start.streamSid;
            log.info(`Stream started: ${streamSid}`);
            break;

          case 'media':
            // Forward audio to Deepgram STT
            if (dgLive && dgLive.getReadyState() === 1) {
              const audioBuffer = Buffer.from(data.media.payload, 'base64');
              dgLive.send(audioBuffer);
            }
            break;

          case 'stop':
            log.info('Twilio stream stopped');
            endCall();
            break;
        }
      } catch (err) {
        log.error(`WS message error: ${err.message}`);
      }
    });

    ws.on('close', () => {
      log.info('Twilio WebSocket closed');
      if (dgLive) {
        try { dgLive.requestClose(); } catch (e) { /* ignore */ }
      }
      endCall();
    });

    ws.on('error', (err) => {
      log.error(`Twilio WebSocket error: ${err.message}`);
      endCall();
    });

    // Send TTS audio back to Twilio via Deepgram TTS
    async function sendTTSResponse(text) {
      if (!callActive || !streamSid) return;

      try {
        const response = await deepgram.speak.request(
          { text },
          {
            model: 'aura-2-thalia-en',
            encoding: 'mulaw',
            sample_rate: 8000,
            container: 'none',
          }
        );

        const stream = await response.getStream();
        if (!stream) {
          log.error('No TTS audio stream returned');
          return;
        }

        const reader = stream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Send audio chunk to Twilio
          if (twilioWs && twilioWs.readyState === 1) {
            const payload = Buffer.from(value).toString('base64');
            twilioWs.send(JSON.stringify({
              event: 'media',
              streamSid,
              media: { payload }
            }));
          }
        }
      } catch (err) {
        log.error(`TTS error: ${err.message}`);
        throw err; // Re-throw so caller can handle
      }
    }
  });

  // Claude conversation handler with timeout
  const conversationHistory = [];

  async function getClaudeResponse(userText) {
    conversationHistory.push({ role: 'user', content: userText });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        system: `You are ${agentName}, a friendly Pokemon card collector making a phone call to a store. You're looking for specific Pokemon cards. Keep responses SHORT (1-2 sentences max) and conversational — this is a phone call, not an email. Be polite and natural. If they don't have what you're looking for, thank them and say goodbye. If they do, express interest and offer to leave your email. Don't repeat yourself.`,
        messages: conversationHistory,
      }, { signal: controller.signal });

      const reply = response.content[0].text;
      conversationHistory.push({ role: 'assistant', content: reply });
      return reply;
    } catch (err) {
      // Remove the failed user message so conversation stays consistent
      conversationHistory.pop();
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  function endCall() {
    if (!callActive) return;
    callActive = false;
    if (callTimeout) clearTimeout(callTimeout);

    // Close Deepgram connection
    if (dgLive) {
      try { dgLive.requestClose(); } catch (e) { /* ignore */ }
    }

    // Send mark to indicate we're done, then close
    if (twilioWs && twilioWs.readyState === 1) {
      try {
        twilioWs.send(JSON.stringify({
          event: 'mark',
          streamSid,
          mark: { name: 'call-end' }
        }));
      } catch (e) { /* ignore */ }
    }

    if (callEndResolve) callEndResolve();
  }

  // Start server on random available port
  function start() {
    return new Promise((resolve, reject) => {
      server.on('error', (err) => {
        log.error(`Server start error: ${err.message}`);
        reject(err);
      });
      server.listen(0, () => {
        const port = server.address().port;
        log.info(`Call server started on port ${port}`);
        resolve(port);
      });
    });
  }

  function stop() {
    return new Promise((resolve) => {
      const forceTimeout = setTimeout(() => {
        log.warn('Force closing call server after timeout');
        resolve();
      }, 5000);

      wss.close(() => {
        server.close(() => {
          clearTimeout(forceTimeout);
          log.info('Call server stopped');
          resolve();
        });
      });
    });
  }

  return {
    start,
    stop,
    getTranscript: () => transcript,
    waitForCallEnd: () => callEndPromise,
  };
}

module.exports = { createCallServer };
