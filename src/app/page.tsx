// Enhanced version of BG Reflector (page.tsx)
"use client";

import { useState, useEffect, useRef } from "react";
import React from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { html } from "@codemirror/lang-html";

function SourceEditor({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    });

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [basicSetup, html(), updateListener],
      }),
      parent: editorRef.current,
    });

    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={editorRef} className="border rounded shadow bg-white h-40 overflow-auto" />;
}

const tagPatterns = [
  /\\n/g,
  /\\r/g,
  /<param\b[^<>]*?\/>/g,
  /<alias\b[^<>]*?\/>/g,
  /%Y/g,
  /%m/g,
  /%d/g,
  /%H/g,
  /%M/g,
  /<PlayerName\s*\/>/g,
  /<Icon[^>]*?\/>/g,
  /<cms[^>]*?\/>/g,
  /<FontStyle[^>]*?>/g,
  /<\/FontStyle>/g
];

function countTags(text: string, regex: RegExp): Record<string, number> {
  const counts: Record<string, number> = {};
  const matches = text.match(regex) || [];
  matches.forEach(tag => {
    counts[tag] = (counts[tag] || 0) + 1;
  });
  return counts;
}

function compareTags(source: string, target: string, regex: RegExp): string[] {
  const sourceTags = source.match(regex) || [];
  const targetTags = target.match(regex) || [];
  const errors: string[] = [];

  sourceTags.forEach(tag => {
    const exactMatch = targetTags.includes(tag);
    const likelyBroken = targetTags.some(t => t.startsWith(tag.slice(0, -2)) && !t.endsWith("/>"));
    if (!exactMatch && !likelyBroken) {
      const lineNum = source.split("\n").findIndex(line => line.includes(tag)) + 1;
      errors.push(`${lineNum}줄: 타겟에서 누락 또는 훼손된 태그 감지 → ${tag}`);
    }
  });
  return errors;
}

export default function Home() {
  const [sourceText, setSourceText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [showLineBreaks, setShowLineBreaks] = useState(false);
  const [targetErrors, setTargetErrors] = useState<string[]>([]);
  const [tagSummary, setTagSummary] = useState<string[]>([]);

  useEffect(() => {
    const mismatchReport: string[] = [];

    tagPatterns.forEach((regex) => {
      const sourceCount = countTags(sourceText, regex);
      const targetCount = countTags(targetText, regex);
      Object.keys(sourceCount).forEach(tag => {
        const srcNum = sourceCount[tag];
        const tgtNum = targetCount[tag] || 0;
        if (srcNum !== tgtNum) {
          mismatchReport.push(`🔸 ${tag} — 소스 ${srcNum}개 / 타겟 ${tgtNum}개`);
        }
      });
    });

    const combinedErrors = [
      ...compareTags(sourceText, targetText, /<Icon[^>]*?\/>/g),
    ];

    setTargetErrors(combinedErrors);
    setTagSummary(mismatchReport);
  }, [sourceText, targetText]);

  return (
    <main className="p-8 bg-[#121212] min-h-screen text-gray-100">
      <title>BG Reflector</title>
      <div className="mb-4 flex items-center justify-between">
        <div className="space-x-4">
          <select className="border rounded px-2 py-1 bg-[#2a2a2a] text-white">
            <option>ArcheAge</option>
            <option>MIR4</option>
          </select>

          <label className="ml-4">
            <input
              type="checkbox"
              checked={showLineBreaks}
              onChange={(e) => setShowLineBreaks(e.target.checked)}
              className="mr-1"
            />
            줄바꿈 표시
          </label>
        </div>
        <button
          className="bg-[#1a73e8] text-white px-4 py-2 rounded shadow hover:bg-[#1967d2]"
          onClick={() => navigator.clipboard.writeText(targetText)}
        >
          전체 복사
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-2">
        <div>
          <label className="font-bold">🟥 소스 입력</label>
          <SourceEditor value={sourceText} onChange={setSourceText} />
        </div>
        <div>
          <label className="font-bold">🟦 타겟 입력</label>
          <SourceEditor value={targetText} onChange={setTargetText} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-4 text-sm text-red-400">
        <ul>
          {targetErrors.length > 0 && <li className="font-bold mb-1">❗ 누락 또는 훼손된 태그:</li>}
          {targetErrors.map((e, idx) => <li key={idx}>• {e}</li>)}
        </ul>
        <ul>
          {tagSummary.length > 0 && <li className="font-bold mb-1">🔍 태그 카운트 요약:</li>}
          {tagSummary.map((e, idx) => <li key={idx}>• {e}</li>)}
        </ul>
      </div>
    </main>
  );
}