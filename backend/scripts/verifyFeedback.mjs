/**
 * Назначение: verify validateFeedbackBody.
 */

import { validateFeedbackBody } from '../src/feedback/validateFeedbackBody.js';

const bug = validateFeedbackBody({
  type: 'bug',
  message: 'Test bug',
  email: 'a@b.co',
});
if (!bug.ok) {
  console.error('bug validation failed', bug);
  process.exit(1);
}

const contactMissingEmail = validateFeedbackBody({
  type: 'contact',
  message: 'Hello',
});
if (contactMissingEmail.ok || contactMissingEmail.code !== 'FEEDBACK_EMAIL_REQUIRED') {
  console.error('contact email required check failed', contactMissingEmail);
  process.exit(1);
}

const contact = validateFeedbackBody({
  type: 'contact',
  message: 'Hello',
  email: 'user@example.com',
  name: 'User',
});
if (!contact.ok) {
  console.error('contact validation failed', contact);
  process.exit(1);
}

console.log('verify:feedback OK');
