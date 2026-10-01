import assert from 'node:assert/strict';
import test from 'node:test';
import { activeGiftPromotions, promotionGiftPrice } from '../src/lib/promotionGift.js';
const now = Date.parse('2026-10-01T12:00:00+03:00');
const offer = extra => ({ id: 1, public_title: 'عرض التصوير', status: 'active', starts_at: '2026-10-01 11:00:00', ends_at: '2026-10-01 13:00:00', ...extra });
test('gift only shows live offers, not historical subscriptions or drafts', () => {
 const rows = [offer({}), offer({id:2,status:'draft'}), offer({id:3,status:'paused'}), offer({id:4,archived_at:'2026-10-01 10:00:00',subscribed:1}), offer({id:5,ends_at:'2026-10-01 12:00:00'}), offer({id:6,starts_at:'2026-10-01 12:01:00'}), offer({id:7,starts_at:'invalid'}), offer({id:8,status:'expired'})];
 assert.deepEqual(activeGiftPromotions(rows,now).map(row=>row.id),[1]);
});
test('public DTO without status works and explicit ISO offsets agree with Cairo SQL times', () => {
 assert.equal(activeGiftPromotions([offer({status:undefined})],now).length,1);
 assert.equal(activeGiftPromotions([offer({starts_at:'2026-10-01T08:00:00Z',ends_at:'2026-10-01T10:00:00Z'})],now).length,1);
 assert.equal(activeGiftPromotions([offer({})],Date.parse('2026-10-01T13:00:00+03:00')).length,0);
});
test('missing prices are not presented as a free offer', () => {
 for (const value of [null,undefined,'', '  ', 'invalid']) assert.equal(promotionGiftPrice(value),null);
 assert.equal(promotionGiftPrice('1500.00'),1500);
 assert.equal(promotionGiftPrice(0),0);
});
