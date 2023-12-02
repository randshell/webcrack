import {
  AsyncTransform,
  applyTransform,
  applyTransformAsync,
  applyTransforms,
} from '@webcrack/ast-utils';
import mergeStrings from '../../unminify/src/transforms/merge-strings';
import { findArrayRotator } from './array-rotator';
import controlFlowObject from './control-flow-object';
import controlFlowSwitch from './control-flow-switch';
import deadCode from './dead-code';
import { findDecoders } from './decoder';
import inlineDecodedStrings from './inline-decoded-strings';
import inlineDecoderWrappers from './inline-decoder-wappers';
import inlineObjectProps from './inline-object-props';
import { findStringArray } from './string-array';
import {
  Sandbox,
  VMDecoder,
  createBrowserSandbox,
  createNodeSandbox,
} from './vm';

export { createBrowserSandbox, createNodeSandbox, type Sandbox };

// https://astexplorer.net/#/gist/b1018df4a8daebfcb1daf9d61fe17557/4ff9ad0e9c40b9616956f17f59a2d9888cd62a4f

export default {
  name: 'deobfuscate',
  tags: ['unsafe'],
  scope: true,
  async run(ast, state, sandbox) {
    if (!sandbox) return;

    const stringArray = findStringArray(ast);
    if (!stringArray) return;

    const rotator = findArrayRotator(stringArray);

    const decoders = findDecoders(stringArray);

    state.changes += applyTransform(ast, inlineObjectProps).changes;

    for (const decoder of decoders) {
      state.changes += applyTransform(
        ast,
        inlineDecoderWrappers,
        decoder.path,
      ).changes;
    }

    const vm = new VMDecoder(sandbox, stringArray, decoders, rotator);
    state.changes += (
      await applyTransformAsync(ast, inlineDecodedStrings, { vm })
    ).changes;

    stringArray.path.remove();
    rotator?.remove();
    decoders.forEach((decoder) => decoder.path.remove());
    state.changes += 2 + decoders.length;

    state.changes += applyTransforms(ast, [
      mergeStrings,
      deadCode,
      controlFlowObject,
      controlFlowSwitch,
    ]).changes;
  },
} satisfies AsyncTransform<Sandbox>;
