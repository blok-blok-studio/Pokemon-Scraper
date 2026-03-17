import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateSyncKey } from '@/lib/sync-auth'

export async function POST(request: NextRequest) {
  if (!validateSyncKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { records } = await request.json()
  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: 'No records provided' }, { status: 400 })
  }

  let synced = 0
  let maxLocalId = 0

  await prisma.$transaction(async (tx) => {
    for (const r of records) {
      if (r.local_id > maxLocalId) maxLocalId = r.local_id

      // Upsert listing
      await tx.cardListing.upsert({
        where: { localId: r.local_id },
        update: {
          source: r.source,
          cardName: r.card_name,
          setName: r.set_name || null,
          condition: r.condition || null,
          price: r.price,
          tcgMarketPrice: r.tcg_market_price || null,
          discountPercent: r.discount_percent || null,
          url: r.url,
          sellerName: r.seller_name || null,
          sellerContact: r.seller_contact || null,
          dealGrade: r.deal_grade || null,
          aiSummary: r.ai_summary || null,
          redFlags: r.red_flags || null,
          alerted: r.alerted || 0,
        },
        create: {
          localId: r.local_id,
          source: r.source,
          cardName: r.card_name,
          setName: r.set_name || null,
          condition: r.condition || null,
          price: r.price,
          tcgMarketPrice: r.tcg_market_price || null,
          discountPercent: r.discount_percent || null,
          url: r.url,
          sellerName: r.seller_name || null,
          sellerContact: r.seller_contact || null,
          dealGrade: r.deal_grade || null,
          aiSummary: r.ai_summary || null,
          redFlags: r.red_flags || null,
          alerted: r.alerted || 0,
          foundAt: r.found_at ? new Date(r.found_at) : new Date(),
        }
      })
      synced++

      // Auto-create seller profile if new seller name
      if (r.seller_name) {
        await tx.seller.upsert({
          where: { name: r.seller_name },
          update: {},
          create: { name: r.seller_name, type: null }
        })

        // Link listing to seller
        const seller = await tx.seller.findUnique({ where: { name: r.seller_name } })
        if (seller) {
          await tx.cardListing.updateMany({
            where: { localId: r.local_id },
            data: { sellerId: seller.id }
          })
        }
      }
    }

    // Update sync cursor
    await tx.syncCursor.upsert({
      where: { tableName: 'card_listings' },
      update: { lastSyncedLocalId: maxLocalId, lastSyncedAt: new Date() },
      create: { tableName: 'card_listings', lastSyncedLocalId: maxLocalId }
    })
  })

  return NextResponse.json({ synced, cursor: maxLocalId })
}
