import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatSidebar } from '../components/ChatSidebar';
import { ChatInput } from '../components/ChatInput';
import { MessageActions } from '../components/MessageActions';
import { WelcomeScreen } from '../components/WelcomeScreen';
import { QuickActions } from '../components/QuickActions';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('AI Counsellor Icon Rendering', () => {
  it('renders ChatSidebar with search, new chat, history, and quick nav icons', () => {
    const { container } = render(
      <ChatSidebar
        sessions={[
          { sessionId: 's1', title: 'Test Session 1', status: 'active', startedAt: '2026-08-23' },
        ]}
        activeSessionId="s1"
        onSelect={vi.fn()}
        onNewChat={vi.fn()}
        onDelete={vi.fn()}
        mobileOpen={false}
      />
    );

    // Verify SVG icons exist in the rendered container
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);

    // Verify New Chat button renders icon + text
    expect(screen.getByRole('button', { name: /new chat/i })).toBeDefined();

    // Verify Search input
    expect(screen.getByLabelText(/search conversations/i)).toBeDefined();

    // Verify recent section label
    expect(screen.getByText(/recent/i)).toBeDefined();
  });

  it('renders ChatInput with send, mic, and paperclip attachment icons', () => {
    const { container } = render(
      <ChatInput onSend={vi.fn()} disabled={false} onStop={vi.fn()} />
    );

    // Verify paperclip attachment button
    expect(screen.getByLabelText(/attach document/i)).toBeDefined();

    // Verify send button
    expect(screen.getByLabelText(/send message/i)).toBeDefined();

    // Verify SVGs are present
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('renders MessageActions with feedback, copy, share, download, bookmark, and regenerate icons', () => {
    const mockMessage = {
      role: 'assistant' as const,
      content: 'Hello, this is a test response.',
      sourcesCited: [],
      suggestedQuestions: [],
      relatedColleges: [],
      actionButtons: [],
    };

    const { container } = render(
      <MessageActions
        message={mockMessage}
        index={0}
        sessionId="s1"
        onFeedback={vi.fn()}
        onRegenerate={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/^Helpful$/i)).toBeDefined();
    expect(screen.getByLabelText(/not helpful/i)).toBeDefined();
    expect(screen.getByLabelText(/copy/i)).toBeDefined();
    expect(screen.getByLabelText(/share/i)).toBeDefined();
    expect(screen.getByLabelText(/download/i)).toBeDefined();
    expect(screen.getByLabelText(/bookmark/i)).toBeDefined();
    expect(screen.getByLabelText(/regenerate/i)).toBeDefined();

    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(8);
  });

  it('renders WelcomeScreen with suggestion card icons', () => {
    const { container } = render(<WelcomeScreen onPick={vi.fn()} />);

    expect(screen.getByText(/admission prediction/i)).toBeDefined();
    expect(screen.getByText(/recommend colleges/i)).toBeDefined();

    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(7); // 1 top sparkles + 6 suggestion icons
  });

  it('renders QuickActions with action icons', () => {
    const actions = [
      { label: 'Compare Colleges', action: 'compare_colleges', params: {} },
      { label: 'Predict Admission', action: 'predict_admission', params: {} },
    ];

    const { container } = render(<QuickActions actions={actions} />);

    expect(screen.getByRole('button', { name: /compare colleges/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /predict admission/i })).toBeDefined();

    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(2);
  });
});
