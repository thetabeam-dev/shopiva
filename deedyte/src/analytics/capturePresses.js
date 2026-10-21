import React from 'react';
import { navigationRef } from '../navigation/root';
import { posthog } from './posthog';

function textFromNode(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node).trim();
  if (Array.isArray(node)) return node.map(textFromNode).filter(Boolean).join(' ').trim();
  if (node && typeof node === 'object' && node.props) return textFromNode(node.props.children);
  return '';
}

function buttonName(props) {
  const label = typeof props.accessibilityLabel === 'string' ? props.accessibilityLabel.trim() : '';
  if (label) return label.slice(0, 80);
  if (typeof props.title === 'string' && props.title.trim()) return props.title.trim().slice(0, 80);
  const text = textFromNode(props.children);
  if (text) return text.slice(0, 80);
  return 'Button';
}

function currentPage() {
  try {
    if (!navigationRef.isReady()) return 'unknown';
    return navigationRef.getCurrentRoute()?.name || 'unknown';
  } catch {
    return 'unknown';
  }
}

function trackPress(onPress, props) {
  if (typeof onPress !== 'function' || onPress.__phTracked) return onPress;
  function tracked(...args) {
    try {
      posthog.capture('button_clicked', {
        button_name: buttonName(props),
        page: currentPage(),
      });
    } catch {
      // Analytics must not block the press.
    }
    return onPress(...args);
  }
  tracked.__phTracked = true;
  return tracked;
}

function trackProps(props) {
  if (!props || typeof props !== 'object') return props;
  if (typeof props.onPress !== 'function') return props;
  const onPress = trackPress(props.onPress, props);
  if (onPress === props.onPress) return props;
  const { key: _key, ...rest } = props;
  return { ...rest, onPress };
}

function patchJsx(runtime) {
  if (!runtime || runtime.__phPatched) return;
  const origJsx = runtime.jsx;
  const origJsxs = runtime.jsxs;
  if (typeof origJsx === 'function') {
    runtime.jsx = (type, props, key) => origJsx(type, trackProps(props), key ?? props?.key);
  }
  if (typeof origJsxs === 'function') {
    runtime.jsxs = (type, props, key) => origJsxs(type, trackProps(props), key ?? props?.key);
  }
  runtime.__phPatched = true;
}

function patchCreateElement() {
  if (React.createElement.__phTracked) return;
  const orig = React.createElement;
  function createElement(type, props, ...children) {
    return orig(type, trackProps(props), ...children);
  }
  createElement.__phTracked = true;
  React.createElement = createElement;
}

patchCreateElement();

try {
  patchJsx(require('react/jsx-runtime'));
} catch {
  // Runtime is optional depending on the Metro JSX transform.
}

try {
  patchJsx(require('react/jsx-dev-runtime'));
} catch {
  // Dev runtime is only present when the dev JSX transform is enabled.
}
