import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './styles/tokens.css';

// Force registration of node definitions
import '@/nodes/input';
import '@/nodes/output';
import '@/nodes/llm-call';

const app = createApp(App);
app.use(createPinia());
app.mount('#app');
