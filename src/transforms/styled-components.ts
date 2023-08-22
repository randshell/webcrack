import * as t from '@babel/types';
import * as m from '@codemod/matchers';
import { Transform } from '.';
import { constMemberExpression } from '../utils/matcher';

/**
 * https://styled-components.com/docs/tooling#template-string-transpilation
 * TODO:
 * - without config
 * - displayName (rename variable)
 */
export default {
  name: 'styled-components',
  tags: ['safe'],
  visitor: () => {
    // Example: styled.div or styled(Inner)
    const tag = m.capture(
      m.or(
        constMemberExpression('styled'),
        m.callExpression(m.identifier('styled'))
      )
    );
    // Example: ["\n  width: 100%;\n"]
    const strings = m.capture(m.arrayOf(m.stringLiteral()));
    const matcher = m.callExpression(
      m.callExpression(constMemberExpression(tag, 'withConfig'), [
        m.objectExpression([
          m.objectProperty(m.identifier('componentId'), m.stringLiteral()),
        ]),
      ]),
      m.anyList(m.arrayExpression(strings), m.zeroOrMore(m.anyExpression()))
    );

    return {
      CallExpression: {
        exit(path) {
          if (!matcher.match(path.node)) return;
          const quasis = strings.current!.map(string =>
            t.templateElement({ raw: string.value })
          );
          const expressions = path.node.arguments.slice(1) as t.Expression[];
          const templateLiteral = t.templateLiteral(quasis, expressions);
          const taggedTemplate = t.taggedTemplateExpression(
            tag.current!,
            templateLiteral
          );
          path.replaceWith(taggedTemplate);
          this.changes++;
        },
      },
      noScope: true,
    };
  },
} satisfies Transform;
