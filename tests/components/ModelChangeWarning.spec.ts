import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ModelChangeWarning from '@/components/inspectors/llm-call/ModelChangeWarning.vue';

describe('ModelChangeWarning', () => {
  it('renders the modal copy with target model name and edge count', () => {
    const wrapper = mount(ModelChangeWarning, {
      props: { open: true, targetModel: 'meta-llama/llama-3', edgeCount: 1 },
    });
    expect(wrapper.text()).toContain('meta-llama/llama-3');
    expect(wrapper.text()).toContain('1 image edge');
  });

  it('emits cancel when Cancel clicked', async () => {
    const wrapper = mount(ModelChangeWarning, {
      props: { open: true, targetModel: 'm', edgeCount: 2 },
    });
    await wrapper.find('[data-testid="mcw-cancel"]').trigger('click');
    expect(wrapper.emitted('cancel')).toBeTruthy();
  });

  it('emits confirm when Continue clicked', async () => {
    const wrapper = mount(ModelChangeWarning, {
      props: { open: true, targetModel: 'm', edgeCount: 2 },
    });
    await wrapper.find('[data-testid="mcw-confirm"]').trigger('click');
    expect(wrapper.emitted('confirm')).toBeTruthy();
  });

  it('does not render content when open=false', () => {
    const wrapper = mount(ModelChangeWarning, {
      props: { open: false, targetModel: 'm', edgeCount: 1 },
    });
    expect(wrapper.find('[data-testid="mcw-confirm"]').exists()).toBe(false);
  });
});
