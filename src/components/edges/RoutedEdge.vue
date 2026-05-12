<script setup lang="ts">
import { computed } from 'vue';
import type { EdgeProps } from '@vue-flow/core';
import { computePath } from './path/compute-path';
import { colorForType } from '@/nodes/port-types';
import type { RoutedEdgeData } from './path/routing/types';

const props = defineProps<EdgeProps<RoutedEdgeData>>();

const path = computed(() => computePath({
  source: { x: props.sourceX, y: props.sourceY },
  target: { x: props.targetX, y: props.targetY },
  sourcePosition: props.sourcePosition,
  targetPosition: props.targetPosition,
  obstacles: props.data?.obstacles ?? [],
  laneOffset: props.data?.laneOffset ?? 0,
}));

const stroke = computed(() => colorForType(props.data?.wireType ?? null));
const strokeWidth = computed(() => props.selected ? 3 : 2);
</script>

<template>
  <!-- 14px-wide transparent hit target for easier mouse selection -->
  <path
    :d="path.d"
    stroke="transparent"
    stroke-width="14"
    fill="none"
    pointer-events="stroke"
  />
  <!-- visible stroke -->
  <path
    :d="path.d"
    :stroke="stroke"
    :stroke-width="strokeWidth"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
    pointer-events="none"
  />
</template>
