import assert from 'node:assert/strict';
import test from 'node:test';
import { safeClientDestination, clientAuthPath } from '../src/lib/clientAuthDestination.js';

const origin = 'https://multitaskagency.com';
const redirect = destination => `?returnTo=${encodeURIComponent(destination)}`;

test('educational booking survives login, signup and required password update', () => {
  const destination = '/dashboard?tab=book-studio';
  for (const path of ['/login', '/register', '/change-password']) {
    const link = new URL(clientAuthPath(path, destination), origin);
    assert.equal(link.pathname, path);
    assert.equal(safeClientDestination(link.search, origin), destination);
  }
});

test('auth redirects reject external addresses, staff routes and unsupported client tabs', () => {
  for (const target of ['https://evil.example/dashboard?tab=book-studio', '//evil.example/dashboard', '/adminmt/login', '/erp', '/dashboard/other', '/dashboard?tab=admin', 'javascript:alert(1)', 'https://[']) {
    assert.equal(safeClientDestination(redirect(target), origin), '/dashboard', target);
  }
});

test('existing client links and legacy video links retain their permitted destination', () => {
  for (const target of ['/dashboard?tab=videos&job=23', '/dashboard?tab=packages', '/dashboard?tab=requests']) {
    assert.equal(safeClientDestination(redirect(target), origin), target);
  }
  assert.equal(safeClientDestination(redirect('/dashboard?tab=montage&job=23'), origin), '/dashboard?tab=videos&job=23');
  assert.equal(safeClientDestination(redirect(`${origin}/dashboard?tab=book-studio`), origin), '/dashboard?tab=book-studio');
});

test('ordinary login and signup keep clean default dashboard paths', () => {
  assert.equal(safeClientDestination('', origin), '/dashboard');
  assert.equal(clientAuthPath('/login', '/dashboard'), '/login');
  assert.equal(clientAuthPath('/register', '/dashboard'), '/register');
});
