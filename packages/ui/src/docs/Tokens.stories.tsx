import type { Meta, StoryObj } from '@storybook/react-vite';
import { color, cssVar, font, radius, space } from '../tokens/tokens';

function Swatches() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section>
        <h2 style={{ color: 'var(--tally-color-text)' }}>Color (switch theme in the toolbar)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {Object.keys(color.light).map((k) => (
            <div key={k} style={{ border: '1px solid var(--tally-color-border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ height: 48, background: cssVar('color', k) }} />
              <code style={{ display: 'block', padding: 8, fontSize: 12, color: 'var(--tally-color-text)' }}>{k}</code>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 style={{ color: 'var(--tally-color-text)' }}>Spacing</h2>
        {Object.entries(space).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--tally-color-text)' }}>
            <code style={{ width: 80 }}>space-{k}</code>
            <div style={{ width: v, height: 12, background: 'var(--tally-color-accent)' }} />
            <code>{v}</code>
          </div>
        ))}
      </section>
      <section style={{ color: 'var(--tally-color-text)' }}>
        <h2>Type scale</h2>
        {Object.entries(font.size).map(([k, v]) => (
          <p key={k} style={{ fontSize: v, margin: '4px 0' }}>
            {k} · {v} · $1,234.56
          </p>
        ))}
        <h2>Radius</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          {Object.entries(radius).map(([k, v]) => (
            <div key={k} style={{ width: 64, height: 64, borderRadius: v, border: '2px solid var(--tally-color-accent)', display: 'grid', placeItems: 'center' }}>
              <code style={{ fontSize: 11 }}>{k}</code>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const meta = { title: 'Foundations/Tokens', component: Swatches, tags: ['!autodocs'] } satisfies Meta<typeof Swatches>;
export default meta;
export const All: StoryObj<typeof meta> = {};
