---
name: voice-outreach
description: Make AI voice calls to card shops and pawn shops to ask about Pokemon card inventory. Uses Twilio for phone calls and Deepgram for speech-to-text and text-to-speech. Only call during business hours in the target's timezone.
metadata:
  openclaw:
    requires:
      bins: ["node"]
      env: ["DEEPGRAM_API_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER", "ANTHROPIC_API_KEY"]
    primaryEnv: "DEEPGRAM_API_KEY"
---

# Voice Outreach

## Description
AI-powered voice calls to card shops and pawn shops asking about Pokemon card inventory. Calls are made via Twilio, with Deepgram handling speech-to-text and text-to-speech. Claude generates real-time conversational responses during the call, and transcripts are analyzed afterward for follow-up signals.

## Tools
- Preview script (no call): `node tools/bland-client/voice-cli.js preview '<target JSON>'`
- Make call: `node tools/bland-client/voice-cli.js call '<target JSON>'`
- Check stats: `node tools/bland-client/voice-cli.js stats`
- Outreach history: `node tools/db/cli.js get-outreach-history '<phone>' <days>`
- Daily spend: `node tools/db/cli.js get-daily-spend`
- Get config: `cat config/config.json`
- Get watchlist: `cat config/watchlist.json`

## Instructions
During the daily outreach cycle (only at outreachTimeHour from config):
1. Check if daily spend is within budget
2. Check if calls today are under maxDailyVoiceCalls from config
3. Load contacts from config/contacts.json
4. For each contact that has a phone number:
   a. Check if current time is between 9am-5pm in their timezone — skip if outside hours
   b. Check outreach history — skip if called within voiceCooldownDays
   c. Preview the script first to verify it looks right
   d. Make the call
   e. Analyze the transcript
   f. If interested or followUp needed, alert via Telegram: "🔔 [name] is interested! Notes: [notes]"
   g. Log everything to outreach_log and api_usage
5. Report summary: calls made, calls skipped, any interested leads

## Rules
- NEVER call outside 9am-5pm in the target's timezone
- NEVER exceed maxDailyVoiceCalls from config
- NEVER call the same phone number within voiceCooldownDays
- Max 120 seconds per call
- ALWAYS log call results and API costs
- If Twilio/Deepgram fails, skip that call and log — never retry a failed call immediately
