// TODO: run babel in the worker instead to avoid bundling it 2x
import * as monaco from 'monaco-editor';
import { createEffect, onCleanup, onMount } from 'solid-js';
import { useDeobfuscateContext } from '../context/DeobfuscateContext';
import { useTheme } from '../hooks/useTheme';
import { registerEvalSelection } from '../monaco/eval-selection';
import { PlaceholderContentWidget } from '../monaco/placeholder-widget';

interface Props {
  models: monaco.editor.ITextModel[];
  currentModel?: monaco.editor.ITextModel;
  onModelChange?: (model: monaco.editor.ITextModel) => void;
}

monaco.editor.defineTheme('dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: { 'editor.background': '#1b1b1f' },
});

export default function MonacoEditor(props: Props) {
  const { deobfuscate, deobfuscating } = useDeobfuscateContext();
  const [theme] = useTheme();
  const viewStates = new WeakMap<
    monaco.editor.ITextModel,
    monaco.editor.ICodeEditorViewState
  >();
  let container: HTMLDivElement | undefined;

  onMount(() => {
    const editor = monaco.editor.create(container!, {
      language: 'javascript',
      automaticLayout: true,
      wordWrap: 'on',
    });

    createEffect(() => {
      setModel(props.currentModel);
    });

    createEffect(() => {
      monaco.editor.setTheme(theme());
    });

    createEffect(() => {
      // TODO: only update current model, or model where the deobfuscation started from
      //
      editor.updateOptions({ readOnly: deobfuscating() });
    });

    function setModel(model?: monaco.editor.ITextModel) {
      const currentModel = editor.getModel();
      if (currentModel) viewStates.set(currentModel, editor.saveViewState()!);
      editor.setModel(model ?? null);
      if (model) editor.restoreViewState(viewStates.get(model) ?? null);
      editor.focus();
    }

    // Go to definition
    const editorOpener = monaco.editor.registerEditorOpener({
      openCodeEditor(_source, resource, selectionOrPosition) {
        const newModel = props.models.find(
          (model) => model.uri.path === resource.path,
        );
        if (!newModel) return false;

        setModel(newModel);

        if (monaco.Range.isIRange(selectionOrPosition)) {
          editor.revealRangeInCenterIfOutsideViewport(selectionOrPosition);
          editor.setSelection(selectionOrPosition);
        } else if (monaco.Selection.isISelection(selectionOrPosition)) {
          editor.revealPositionInCenterIfOutsideViewport(selectionOrPosition);
          editor.setPosition(selectionOrPosition);
        }

        props.onModelChange?.(newModel);

        return true;
      },
    });

    // Enable IntelliSense for multiple files
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

    const placeholder = new PlaceholderContentWidget(
      '// Paste your obfuscated or bundled code here',
      editor,
    );

    const deobfuscateAction = editor.addAction({
      id: 'editor.action.deobfuscate',
      label: 'Deobfuscate',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.Enter],
      run() {
        deobfuscate();
      },
    });

    const evalAction = registerEvalSelection(editor);

    const commandPalette = editor.getAction('editor.action.quickCommand')!;
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP,
      () => void commandPalette.run(),
    );

    onCleanup(() => {
      editorOpener.dispose();
      placeholder.dispose();
      deobfuscateAction.dispose();
      evalAction.dispose();
    });
  });

  return (
    <div
      ref={container}
      class="editor"
      style="height: calc(100vh - 64px)"
    ></div>
  );
}
