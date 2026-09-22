/** Demo chats — replace with API / socket when wired. */

/**
 * @typedef {{ id: string; text: string; outgoing: boolean; timeLabel: string }} ChatMessage
 */

export const MOCK_CHATS = [
  {
    id: 'c1',
    name: 'UrbanWear Official Store',
    lastMessage: '✓✓ Your return label has been generated — tap to view.',
    lastAtLabel: '10:24',
    unreadCount: 2,
    avatarHue: 160,
  },
  {
    id: 'c2',
    name: 'SecureNet Software Sellers',
    lastMessage: 'We are still waiting on the courier POD.',
    lastAtLabel: 'Yesterday',
    unreadCount: 0,
    avatarHue: 210,
  },
  {
    id: 'c3',
    name: 'Deedyte Support',
    lastMessage: 'Thanks for contacting us! Is your issue resolved?',
    lastAtLabel: 'Mon',
    unreadCount: 1,
    avatarHue: 125,
  },
  {
    id: 'c4',
    name: 'TechVault Electronics',
    lastMessage: '✓ Partial credit has been applied.',
    lastAtLabel: '12/04/2025',
    unreadCount: 0,
    avatarHue: 32,
  },
];

/** @type {Record<string, ChatMessage[]>} */
const SEED_MESSAGES = {
  c1: [
    { id: 'm1', text: 'Hi — I need a return label for ORD-2891.', outgoing: true, timeLabel: '09:12' },
    { id: 'm2', text: 'Hello! We can help with that. One moment.', outgoing: false, timeLabel: '09:14' },
    { id: 'm3', text: 'Please confirm your pickup address is still Mumbai?', outgoing: false, timeLabel: '09:18' },
    { id: 'm4', text: 'Yes, same address on the order.', outgoing: true, timeLabel: '09:20' },
    { id: 'm5', text: 'Great — generating the label now.', outgoing: false, timeLabel: '10:02' },
    { id: 'm6', text: 'Your return label has been generated — tap to view.', outgoing: false, timeLabel: '10:24' },
  ],
  c2: [
    { id: 'm1', text: 'Any update on the courier trace?', outgoing: true, timeLabel: '14:02' },
    { id: 'm2', text: 'We are still waiting on the courier POD.', outgoing: false, timeLabel: '16:40' },
    { id: 'm3', text: 'We will ping you as soon as the carrier responds.', outgoing: false, timeLabel: '16:41' },
  ],
  c3: [
    { id: 'm1', text: 'I cannot find my refund in the app.', outgoing: true, timeLabel: '11:00' },
    {
      id: 'm2',
      text: 'Thanks for contacting us! Is your issue resolved?',
      outgoing: false,
      timeLabel: '11:05',
    },
  ],
  c4: [
    { id: 'm1', text: 'Thanks for the quick resolution.', outgoing: true, timeLabel: '08:30' },
    { id: 'm2', text: '✓ Partial credit has been applied.', outgoing: false, timeLabel: '08:31' },
  ],
};

/**
 * @param {string} chatId
 * @returns {ChatMessage[]}
 */
export function getSeedMessages(chatId) {
  return SEED_MESSAGES[chatId] ? [...SEED_MESSAGES[chatId]] : [];
}
