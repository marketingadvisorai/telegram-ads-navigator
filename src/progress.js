const kb = (rows) => ({ inline_keyboard: rows });
const bt = (text, data) => ({ text, callback_data: data });

const ACTIONS = {
  open: {
    title: '✨ Ads Navigator',
    stages: [
      'Checking connected ad platforms',
      'Loading account list',
      'Preparing account picker',
    ],
  },
  picker: {
    title: '✨ Ads Navigator',
    stages: [
      'Refreshing account list',
      'Sorting connected accounts',
      'Preparing account picker',
    ],
  },
  account: {
    title: '🧾 Account Overview',
    stages: [
      'Looking up account',
      'Fetching latest performance',
      'Preparing summary screen',
    ],
  },
  campaigns: {
    title: '📋 Campaigns',
    stages: [
      'Loading account context',
      'Fetching campaign performance',
      'Preparing campaign view',
    ],
  },
  campaign: {
    title: '🎯 Campaign Detail',
    stages: [
      'Opening selected campaign',
      'Fetching campaign metrics',
      'Preparing detail screen',
    ],
  },
  terms: {
    title: '🔎 Search Terms',
    stages: [
      'Opening campaign context',
      'Reading search term data',
      'Preparing search term view',
    ],
  },
  convs: {
    title: '⚙️ Conversion Actions',
    stages: [
      'Loading account settings',
      'Reading conversion actions',
      'Preparing conversion view',
    ],
  },
  alerts: {
    title: '🎯 Alerts',
    stages: [
      'Checking account health',
      'Reviewing high priority signals',
      'Preparing alert summary',
    ],
  },
  madsets: {
    title: '🧩 Ad Sets',
    stages: [
      'Opening Meta campaign',
      'Reading ad set metrics',
      'Preparing ad set view',
    ],
  },
  mads: {
    title: '📣 Ads',
    stages: [
      'Opening Meta campaign',
      'Reading ad level metrics',
      'Preparing ad view',
    ],
  },
};

function buildLines(title, stages, activeIndex) {
  return [
    title,
    '',
    ...stages.map((stage, index) => {
      if (index < activeIndex) return `✅ ${stage}`;
      if (index === activeIndex) return `⏳ ${stage}`;
      return `▫️ ${stage}`;
    }),
    '',
    'Read only mode is on.',
  ];
}

export function getProgressPlan(action) {
  return ACTIONS[action] || ACTIONS.account;
}

export function createProgressScreen(action, activeIndex, callbackData) {
  const plan = getProgressPlan(action);
  return {
    text: buildLines(plan.title, plan.stages, activeIndex).join('\n'),
    reply_markup: kb([[bt('⏳ Working…', callbackData || 'noop')]]),
  };
}

export async function runProgressSteps({ action, callbackData, onUpdate, minStepDelayMs = 280 }) {
  const plan = getProgressPlan(action);
  const startedAt = Date.now();

  for (let index = 0; index < plan.stages.length; index += 1) {
    const stepStart = Date.now();
    await onUpdate(createProgressScreen(action, index, callbackData));
    const elapsed = Date.now() - stepStart;
    const remaining = minStepDelayMs - elapsed;
    if (remaining > 0 && index < plan.stages.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  }

  return { plan, elapsedMs: Date.now() - startedAt };
}
