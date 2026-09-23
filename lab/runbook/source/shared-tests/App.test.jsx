import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import axe from 'axe-core';
import App from '../src/App.jsx';

afterEach(cleanup);

async function chooseStatus(user, status) {
  const filter = screen.queryByRole('combobox', { name: /status/i });
  if (filter) {
    await user.selectOptions(filter, screen.getByRole('option', { name: status }));
    return;
  }
  const group = screen.queryByRole('group', { name: /status/i });
  if (group) {
    await user.click(within(group).getByRole('radio', { name: status }));
    return;
  }
  await user.click(screen.getByRole('button', { name: status, exact: true }));
}

describe('Runbook brief', () => {
  it('renders the exact heading, summary, three runs and selected-run note', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Experiment runs' })).toBeInTheDocument();
    expect(screen.getByText('Small tests. Clear results.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mobile table wrap/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Empty filter state/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Keyboard focus order/ })).toBeInTheDocument();
    expect(document.body).toHaveTextContent('The last column moves below the table at 390px. Two labels are too small to read.');
    expect(document.body).toHaveTextContent('Mica 7B');
    expect(document.body).toHaveTextContent('Pine 3');
    expect(document.body).toHaveTextContent('Needs review');
    expect(document.body).toHaveTextContent('Passed');
    expect(document.body).toHaveTextContent('Failed');
    expect(document.body).toHaveTextContent('6 of 8 checks');
    expect(document.body).toHaveTextContent('8 of 8 checks');
    expect(document.body).toHaveTextContent('4 of 8 checks');
    expect(screen.getByRole('button', { name: 'Inspect run' })).toBeInTheDocument();
    expect(document.body).toHaveTextContent('01:42');
    expect(document.body).toHaveTextContent('$0.03');
    expect(document.body).toHaveTextContent('Today, 10:24');
    expect(document.body).toHaveTextContent('00:58');
    expect(document.body).toHaveTextContent('$0.01');
    expect(document.body).toHaveTextContent('Today, 09:51');
    expect(document.body).toHaveTextContent('02:13');
    expect(document.body).toHaveTextContent('$0.04');
    expect(document.body).toHaveTextContent('Yesterday, 16:08');
  });

  it('filters runs and selects a run from the keyboard-operable list', async () => {
    const user = userEvent.setup();
    render(<App />);
    await chooseStatus(user, 'Passed');
    expect(screen.getByRole('button', { name: /Empty filter state/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mobile table wrap/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Keyboard focus order/ })).not.toBeInTheDocument();

    await chooseStatus(user, 'All runs');
    const secondRun = screen.getByRole('button', { name: /Empty filter state/ });
    secondRun.focus();
    await user.keyboard('{Enter}');
    expect(secondRun).toHaveAttribute('aria-pressed', 'true');
    const selected = screen.getByRole('region', { name: 'Selected run' });
    expect(within(selected).getByText('Empty filter state')).toBeInTheDocument();
  });

  it('shows the empty-filter preview and clear filter restores all runs', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /empty state preview/i }));
    expect(screen.getByText('No runs match this filter')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(screen.getByRole('button', { name: /Mobile table wrap/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Empty filter state/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Keyboard focus order/ })).toBeInTheDocument();
  });

  it('exposes loading and error previews, with a return to the normal state', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /loading preview/i }));
    expect(screen.getByRole('status')).toHaveTextContent('Loading runs…');
    await user.click(screen.getAllByRole('button', { name: /show normal state/i })[0]);
    await user.click(screen.getByRole('button', { name: /error preview/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load experiment runs.');
  });

  it('keeps the content inside a main landmark and has no basic axe violations', async () => {
    const { container } = render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
    const results = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations.map(({ id, help }) => `${id}: ${help}`)).toEqual([]);
  });
});
