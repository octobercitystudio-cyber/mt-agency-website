import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('projects workspace removes the service catalog but keeps creation and service filtering', async () => {
  const source = await load('src/erp/ERPProjects.jsx');

  assert.doesNotMatch(source, /CustomServiceCatalog/);
  assert.match(source, /import \{ CUSTOM_SERVICES, serviceMeta \} from '\.\/customServices'/);
  assert.match(source, /startCustomService\('custom',event\)/);
  assert.match(source, /<CustomServiceForm/);
  assert.match(source, /aria-label="تصفية حسب نوع الخدمة"/);
  assert.match(source, /<option value="all">كل الخدمات<\/option>/);
  assert.match(source, /Object\.entries\(CUSTOM_SERVICES\)\.map/);
});

test('filtered projects render once as one vertical interactive ledger', async () => {
  const source = await load('src/erp/ERPProjects.jsx');

  assert.match(source, /<ProjectsView projects=\{filteredProjects\}/);
  assert.match(source, /<section className="project-list" aria-label="قائمة المشروعات">\{projects\.map\(project=>/);
  assert.equal(source.match(/className="project-record"/g)?.length, 1);
  assert.doesNotMatch(source, /className="project-cards"/);
  assert.match(source, /aria-label=\{`فتح تفاصيل مشروع \$\{project\.name\}/);
  assert.match(source, /onClick=\{event=>onOpen\(project,event\)\}/);
});

test('each project record preserves operational, financial, and workload facts', async () => {
  const source = await load('src/erp/ERPProjects.jsx');

  for (const marker of [
    'project-record__identity',
    'project-record__schedule',
    'project-record__finance',
    'project-record__workload',
    'قيمة الاتفاق',
    'المدفوع',
    'المتبقي',
    'تقدم المشروع',
    'الخطوة التالية',
  ]) assert.ok(source.includes(marker), `missing project ledger marker: ${marker}`);

  assert.match(source, /\{done\}<\/b> \/ \{pt\.length\} مهام/);
  assert.match(source, /\{published\}<\/b> \/ \{pc\.length\} محتوى/);
  assert.match(source, /<Status meta=\{PROJECT_STATUS\[project\.status\]\}/);
});

test('project ledger is one record per row and reflows without horizontal overflow', async () => {
  const css = await load('src/erp/ERPProjectsCustomServices.css');

  assert.match(css, /\.project-list\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /\.project-record\{display:grid;grid-template-columns:/);
  assert.match(css, /@media\(max-width:1100px\)\{\.project-record\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:700px\)\{\.project-record\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /\.project-record:focus-visible/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});
