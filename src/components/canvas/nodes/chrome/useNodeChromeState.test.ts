import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveNodeChromeState } from './useNodeChromeState';

test('resolveNodeChromeState keeps prompt preview collapsed by default in full mode', () => {
  const state = resolveNodeChromeState({
    isHovered: false,
    focusedWithin: false,
    isPromptFocused: false,
    selected: false,
    displayMode: 'full',
    hasOutput: false,
    expanded: false,
  });

  assert.deepEqual(state, {
    isActive: false,
    showTopToolbar: false,
    showFooterRail: false,
    showPromptTeaser: true,
    showPromptEditor: false,
    showHandles: false,
    showTopBadges: false,
    showSecondaryContent: true,
  });
});

test('resolveNodeChromeState expands the composer while prompt focus is active', () => {
  const state = resolveNodeChromeState({
    isHovered: true,
    focusedWithin: true,
    isPromptFocused: true,
    selected: false,
    displayMode: 'full',
    hasOutput: false,
    expanded: true,
  });

  assert.equal(state.isActive, true);
  assert.equal(state.showTopToolbar, true);
  assert.equal(state.showFooterRail, true);
  assert.equal(state.showPromptTeaser, false);
  assert.equal(state.showPromptEditor, true);
  assert.equal(state.showHandles, true);
});

test('resolveNodeChromeState shows hover chrome on full-mode prompt nodes', () => {
  const state = resolveNodeChromeState({
    isHovered: true,
    focusedWithin: false,
    isPromptFocused: false,
    selected: false,
    displayMode: 'full',
    hasOutput: false,
    expanded: false,
  });

  assert.equal(state.showTopToolbar, true);
  assert.equal(state.showFooterRail, true);
  assert.equal(state.showPromptTeaser, true);
  assert.equal(state.showPromptEditor, false);
  assert.equal(state.showHandles, true);
});

test('resolveNodeChromeState keeps hover chrome available in compact mode', () => {
  const state = resolveNodeChromeState({
    isHovered: true,
    focusedWithin: false,
    isPromptFocused: false,
    selected: false,
    displayMode: 'compact',
    hasOutput: false,
    expanded: false,
  });

  assert.equal(state.showTopToolbar, true);
  assert.equal(state.showFooterRail, true);
  assert.equal(state.showPromptTeaser, true);
  assert.equal(state.showPromptEditor, false);
  assert.equal(state.showHandles, true);
});

test('resolveNodeChromeState still shows output controls on hover', () => {
  const state = resolveNodeChromeState({
    isHovered: true,
    focusedWithin: false,
    isPromptFocused: false,
    selected: false,
    displayMode: 'full',
    hasOutput: true,
    expanded: false,
  });

  assert.equal(state.showTopToolbar, true);
  assert.equal(state.showFooterRail, true);
  assert.equal(state.showPromptTeaser, true);
  assert.equal(state.showPromptEditor, false);
  assert.equal(state.showHandles, true);
});

test('resolveNodeChromeState suppresses heavy chrome in summary mode', () => {
  const state = resolveNodeChromeState({
    isHovered: true,
    focusedWithin: false,
    isPromptFocused: false,
    selected: false,
    displayMode: 'summary',
    hasOutput: true,
    expanded: false,
  });

  assert.deepEqual(state, {
    isActive: false,
    showTopToolbar: false,
    showFooterRail: false,
    showPromptTeaser: false,
    showPromptEditor: false,
    showHandles: true,
    showTopBadges: true,
    showSecondaryContent: false,
  });
});
