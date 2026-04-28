const test = require('node:test');
const assert = require('node:assert/strict');

const { __test } = require('./assistantBriefing');

test('parseAssistantResponse sanitizes invalid briefing fields', () => {
  const briefing = __test.parseAssistantResponse(JSON.stringify({
    summary: 'Trip looks ready.',
    topRisks: [
      {
        title: 'Rain risk',
        reason: 'Storms are possible.',
        severity: 'severe',
        actionLabel: 'Review',
        actionTarget: 'delete_trip',
        eventId: 123,
      },
      {
        title: 'Missing reason',
        severity: 'warning',
      },
    ],
    nextBestActions: [
      {
        title: 'Open checklist',
        reason: 'Packing item suggested.',
        actionLabel: 'Checklist',
        actionTarget: 'checklist',
      },
      {
        title: 'Invalid action',
        reason: 'Missing target.',
        actionLabel: 'Do it',
      },
    ],
    suggestedChecklistItems: [
      {
        text: 'Pack rain jacket',
        reason: 'Rain is possible.',
        scope: 'family',
      },
      {
        text: '',
        reason: 'No text should be dropped.',
      },
    ],
    suggestedBackupEvents: [
      {
        title: 'Museum',
        reason: 'Indoor backup.',
        eventType: 'restaurant',
      },
      {
        title: 'Gallery',
        reason: 'Indoor backup.',
        eventType: 'activity',
        date: '2026-06-19',
      },
    ],
  }));

  assert.equal(briefing.summary, 'Trip looks ready.');
  assert.deepEqual(briefing.topRisks, [{
    title: 'Rain risk',
    reason: 'Storms are possible.',
    severity: 'info',
    actionLabel: 'Review',
    actionTarget: undefined,
    eventId: undefined,
  }]);
  assert.deepEqual(briefing.nextBestActions, [{
    title: 'Open checklist',
    reason: 'Packing item suggested.',
    actionLabel: 'Checklist',
    actionTarget: 'checklist',
    eventId: undefined,
  }]);
  assert.deepEqual(briefing.suggestedChecklistItems, [{
    text: 'Pack rain jacket',
    reason: 'Rain is possible.',
    scope: 'shared',
    dueDate: undefined,
  }]);
  assert.deepEqual(briefing.suggestedBackupEvents, [{
    title: 'Gallery',
    reason: 'Indoor backup.',
    eventType: 'activity',
    date: '2026-06-19',
    locationHint: undefined,
  }]);
});

test('parseTodayResponse drops invalid watch items and action targets', () => {
  const briefing = __test.parseTodayResponse(JSON.stringify({
    summary: 'Watch today closely.',
    nextAction: {
      title: 'Review transfer',
      reason: 'Timing is tight.',
      actionLabel: 'Open',
      actionTarget: 'expenses',
      eventId: 'event-1',
    },
    watchItems: [
      {
        title: 'Flight delay',
        reason: 'Departure is delayed.',
        severity: 'urgent',
        eventId: 'flight-1',
      },
      {
        title: 'No reason',
      },
    ],
    fallbackIdeas: [
      {
        title: 'Indoor lunch',
        reason: 'Rain nearby.',
      },
      {
        title: 'Missing reason',
      },
    ],
    collaboratorMessage: 42,
  }));

  assert.equal(briefing.summary, 'Watch today closely.');
  assert.equal(briefing.nextAction, undefined);
  assert.deepEqual(briefing.watchItems, [{
    title: 'Flight delay',
    reason: 'Departure is delayed.',
    severity: 'info',
    eventId: 'flight-1',
  }]);
  assert.deepEqual(briefing.fallbackIdeas, [{
    title: 'Indoor lunch',
    reason: 'Rain nearby.',
  }]);
  assert.equal(briefing.collaboratorMessage, undefined);
});

test('parseTripAnswer validates root object and answer arrays', () => {
  assert.throws(
    () => __test.parseTripAnswer('[]'),
    /root must be an object|complete JSON object/
  );

  const answer = __test.parseTripAnswer(JSON.stringify({
    answer: 'You have one flight.',
    supportingFacts: ['Flight UA123', 123, 'SFO to SJO'],
    relatedEventIds: ['flight-1', null, 'flight-2'],
    caveat: 123,
  }));

  assert.deepEqual(answer, {
    answer: 'You have one flight.',
    supportingFacts: ['Flight UA123', 'SFO to SJO'],
    relatedEventIds: ['flight-1', 'flight-2'],
    caveat: undefined,
  });
});

test('deterministic trip answer handles flight and missing weather questions', () => {
  const context = {
    trip: { name: 'Costa Rica' },
    events: [
      {
        id: 'flight-1',
        type: 'flight',
        name: 'Flight UA123',
        departureAirport: 'SFO',
        arrivalAirport: 'SJO',
        startDate: '2026-06-18T06:00:00Z',
      },
    ],
    weather: [],
    flightStatuses: [],
    notifications: [],
  };

  const flightAnswer = __test.buildDeterministicTripAnswer({ context, question: 'What flights are in this trip?' });
  assert.equal(flightAnswer.answer, 'I found 1 flight event in this trip.');
  assert.deepEqual(flightAnswer.relatedEventIds, ['flight-1']);
  assert.equal(flightAnswer.caveat, 'No live flight status snapshots are available in the current context.');

  const weatherAnswer = __test.buildDeterministicTripAnswer({ context, question: 'Will it rain?' });
  assert.equal(weatherAnswer.answer, 'I do not see weather snapshots in the current trip context.');
});

test('parseReplanResponse sanitizes review-only replan suggestions', () => {
  const briefing = __test.parseReplanResponse(JSON.stringify({
    summary: 'Consider a backup.',
    suggestions: [
      {
        title: 'Move beach time',
        reason: 'Rain is likely.',
        severity: 'urgent',
        suggestionType: 'weather',
        actionLabel: 'Review event',
        actionTarget: 'delete',
        eventId: 123,
      },
      {
        title: 'Missing reason',
      },
    ],
    fallbackIdeas: [
      { title: 'Museum', reason: 'Indoor option.' },
      { title: 'Bad idea' },
    ],
    suggestedChecklistItems: [
      { text: 'Pack rain jackets', reason: 'Rain likely.', scope: 'group' },
    ],
    caveat: 123,
  }));

  assert.deepEqual(briefing.suggestions, [{
    title: 'Move beach time',
    reason: 'Rain is likely.',
    severity: 'info',
    suggestionType: 'weather',
    actionLabel: 'Review event',
    actionTarget: undefined,
    eventId: undefined,
  }]);
  assert.deepEqual(briefing.fallbackIdeas, [{ title: 'Museum', reason: 'Indoor option.' }]);
  assert.deepEqual(briefing.suggestedChecklistItems, [{
    text: 'Pack rain jackets',
    reason: 'Rain likely.',
    scope: 'shared',
    dueDate: undefined,
  }]);
  assert.equal(briefing.caveat, undefined);
});
