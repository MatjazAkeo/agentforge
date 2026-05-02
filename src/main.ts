import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './styles/tokens.css';
import './styles/vue-flow-overrides.css';

// Force registration of node definitions
import '@/nodes/input';
import '@/nodes/output';
import '@/nodes/llm-call';
import '@/nodes/break';
import '@/nodes/loop-controller';
import '@/nodes/tool';
import '@/nodes/tool-group';
import '@/nodes/tool-runner';

// Tauri's plugin-http leaks an "Unhandled Promise Rejection: The resource id X
// is invalid" when a request is aborted mid-flight. The error fires from an
// internal cleanup promise we can't reach via try/catch in the call site.
// Swallow these specific rejections so the dev console stays usable.
window.addEventListener('unhandledrejection', (e) => {
  const msg = String((e.reason as { message?: string })?.message ?? e.reason);
  if (msg.includes('resource id') && msg.includes('invalid')) {
    e.preventDefault();
    return;
  }
  if (msg === 'Aborted' || msg.includes('AbortError')) {
    e.preventDefault();
    return;
  }
});

const app = createApp(App);
app.use(createPinia());
app.mount('#app');
