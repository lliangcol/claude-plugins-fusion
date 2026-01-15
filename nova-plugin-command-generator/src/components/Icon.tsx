import React from 'react';

const icons = {
  scenes: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h6l2 2h8v10H4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  commands: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14M5 12h14M5 17h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  generator: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h12v10H6z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 10h6M9 14h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  workflows: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h6v4H6zM12 13h6v4h-6z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 9h6M6 15h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  steps: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 6h10M7 12h10M7 18h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="5" cy="6" r="1.2" fill="currentColor" />
      <circle cx="5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="5" cy="18" r="1.2" fill="currentColor" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h8l4 4v6H6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 13h4M10 17h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h6l2 2h8v8H4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  export: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v10M8 8l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 14v5h14v-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v10M8 10l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 18h14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="6" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="18" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 11l8-4M8 13l8 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12l4 4L19 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export type IconName = keyof typeof icons;

export const Icon = ({ name, className }: { name: IconName; className?: string }) => (
  <span className={className ?? 'icon'}>{icons[name]}</span>
);
