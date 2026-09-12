import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { clientSelectionAfterQueryEdit, filterClientOptions, isClientSelectionValueValid, nextClientOptionIndex, normalizeClientSearchText } from '../src/lib/clientSearch.js';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('client search normalizes Arabic spelling, diacritics and Arabic or Latin phone digits', () => {
  assert.equal(normalizeClientSearchText('إِيمَان فَتْحِي'), 'ايمان فتحي');
  assert.equal(normalizeClientSearchText('فتاة هدى'), 'فتاه هدي');
  const clients = [
    { id: 7, name: 'إيمان فتحي', phone1: '٠١٠١٢٣٤٥٦٧٨', status: 'active' },
    { id: 8, name: 'ايمان فتحي', phone1: '01099999999', status: 'active' },
  ];
  assert.deepEqual(filterClientOptions(clients, 'ايمان', '').map(client => client.id), [7, 8]);
  assert.deepEqual(filterClientOptions(clients, '01012345678', '').map(client => client.id), [7]);
  assert.deepEqual(filterClientOptions(clients, '٠١٠٩٩٩٩٩٩٩٩', '').map(client => client.id), [8]);
  assert.equal(filterClientOptions(clients, 'غير مطابق', 8)[0].id, 8, 'selected client remains visible by ID');
});

test('keyboard navigation stays bounded and supports first or last option', () => {
  assert.equal(nextClientOptionIndex(-1, 'ArrowDown', 3), 0);
  assert.equal(nextClientOptionIndex(-1, 'ArrowUp', 3), 2);
  assert.equal(nextClientOptionIndex(2, 'ArrowDown', 3), 2);
  assert.equal(nextClientOptionIndex(0, 'ArrowUp', 3), 0);
  assert.equal(nextClientOptionIndex(1, 'Home', 3), 0);
  assert.equal(nextClientOptionIndex(1, 'End', 3), 2);
});

test('typed text never counts as a required client selection and editing clears a stale client ID', async () => {
  const clients = [{ id: 7, name: 'عميل محدد', status: 'active' }];
  assert.equal(isClientSelectionValueValid(clients, ''), false);
  assert.equal(isClientSelectionValueValid(clients, 'اسم مكتوب يدويًا'), false);
  assert.equal(isClientSelectionValueValid(clients, '7'), true);
  assert.equal(clientSelectionAfterQueryEdit('7'), '');
  assert.equal(clientSelectionAfterQueryEdit('all', { allowAll: true, allValue: 'all' }), 'all');
  assert.equal(isClientSelectionValueValid(clients, 'all', { allowAll: true, allValue: 'all' }), true);

  const source = await load('src/components/ClientCombobox.jsx');
  assert.match(source, /setCustomValidity\(required && !hasValidSelection/);
  assert.match(source, /required=\{required && !hasValidSelection\}/);
  assert.match(source, /clientSelectionAfterQueryEdit\(value, \{ allowAll, allValue \}\)/);
  assert.match(source, /onChange\?\.\(nextValue, null\)/);
});

test('shared combobox has complete ARIA, ID-only selection, all-clients and create-client actions', async () => {
  const source = await load('src/components/ClientCombobox.jsx');
  assert.match(source, /role="combobox"/); assert.match(source, /aria-expanded=\{open\}/); assert.match(source, /aria-controls=/); assert.match(source, /aria-activedescendant=/); assert.match(source, /role="listbox"/); assert.match(source, /role="option"/);
  assert.match(source, /onChange\?\.\(row\.kind === 'all' \? allValue : row\.id/); assert.match(source, /onCreateClient\?\.\(\)/); assert.match(source, /event\.key === 'Enter'/); assert.match(source, /event\.key === 'Escape'/); assert.doesNotMatch(source, /onChange\?\.\(query/);
});

test('all eight active client pickers use the shared component and preserve caller side effects', async () => {
  const files = ['src/erp/ERPAddBookingModal.jsx','src/erp/CustomServiceForm.jsx','src/erp/BookingBlockConversionForm.jsx','src/erp/ERPBookingDayActionsDialog.jsx','src/erp/ERPFinance.jsx','src/erp/ERPOfferGenerator.jsx','src/erp/ERPPackages.jsx','src/erp/ERPPostProduction.jsx'];
  const sources = await Promise.all(files.map(load));
  sources.forEach((source, index) => assert.match(source, /ClientCombobox/, files[index]));
  assert.match(sources[0], /onCreateClient=\{\(\) => setIsClientModalOpen\(true\)\}/); assert.match(sources[0], /client_package_id: ''/);
  assert.match(sources[2], /setPackageId\(''\)/); assert.match(sources[2], /setDraft\(null\)/);
  assert.match(sources[4], /source_id:txForm\.source_type==='client_package'\?'':txForm\.source_id/);
  assert.match(sources[5], /setForm\(\{\.\.\.form,client_id:clientId\}\)/);
  assert.match(sources[6], /updateFormField\('client_id', clientId\)/);
  assert.match(sources[7], /allowAll allValue="all" allLabel="كل العملاء"/);
});
