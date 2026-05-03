<script setup lang="ts">
import { ref } from 'vue';
import { colorForType, type DataType } from '@/nodes/port-types';

interface PortDescriptor {
  id: string;
  type: DataType;
  description: string;
}

defineProps<{
  inputs?: PortDescriptor[];
  outputs?: PortDescriptor[];
}>();

const open = ref(false);
</script>

<template>
  <section v-if="inputs?.length || outputs?.length" class="border-t border-border-base">
    <h4
      @click="open = !open"
      class="m-0 py-2.5 text-sm cursor-pointer select-none"
    >{{ open ? '▼' : '▶' }} Ports</h4>

    <div v-show="open" class="pb-3 flex flex-col gap-2.5">
      <div v-if="inputs?.length">
        <div class="text-[10px] uppercase opacity-50 mb-1.5">inputs</div>
        <ul class="flex flex-col gap-2">
          <li v-for="p in inputs" :key="`in-${p.id}`" class="flex flex-col gap-0.5">
            <div class="flex items-center gap-2">
              <span
                class="w-2 h-2 rounded-full flex-shrink-0"
                :style="{ background: colorForType(p.type) }"
                :title="p.type"
              />
              <span class="font-mono text-[11px]">{{ p.id }}</span>
            </div>
            <div class="text-[11px] opacity-60 leading-snug pl-4">{{ p.description }}</div>
          </li>
        </ul>
      </div>

      <div v-if="outputs?.length">
        <div class="text-[10px] uppercase opacity-50 mb-1.5">outputs</div>
        <ul class="flex flex-col gap-2">
          <li v-for="p in outputs" :key="`out-${p.id}`" class="flex flex-col gap-0.5">
            <div class="flex items-center gap-2">
              <span
                class="w-2 h-2 rounded-full flex-shrink-0"
                :style="{ background: colorForType(p.type) }"
                :title="p.type"
              />
              <span class="font-mono text-[11px]">{{ p.id }}</span>
            </div>
            <div class="text-[11px] opacity-60 leading-snug pl-4">{{ p.description }}</div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
