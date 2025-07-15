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
  }, []);

  return <div ref={editorRef} className="border rounded shadow bg-white h-40 overflow-auto" />;
}

export default function Home() {
  const [sourceText, setSourceText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [showLineBreaks, setShowLineBreaks] = useState(false);
  const [showCharWidthRule, setShowCharWidthRule] = useState(false);
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);
  const [targetErrors, setTargetErrors] = useState<string[]>([]);

  const validateText = (text: string): string[] => {
    const lines = text.split("\n");
    const errors: string[] = [];

    const iconTagRegex = /<Icon[^>]*?\/>/g;
    const invalidIconTagRegex = /<Icon[^>]*[^/]>/g;

    const sourceIcons: string[] = sourceText.match(iconTagRegex) || [];
    const targetIcons: string[] = targetText.match(iconTagRegex) || [];
    const invalidTargetIcons: string[] = targetText.match(invalidIconTagRegex) || [];

    sourceIcons.forEach((tag) => {
      const exactMatch = targetIcons.includes(tag);
      if (!exactMatch) {
        const lineNum = sourceText.split("\n").findIndex((line) => line.includes(tag)) + 1;
        errors.push(`${lineNum}줄: 타겟에 누락되었거나 훼손된 태그 → ${tag}`);
      }
    });

    invalidTargetIcons.forEach((tag) => {
      const lineNum = targetText.split("\n").findIndex((line) => line.includes(tag)) + 1;
      errors.push(`${lineNum}줄: 닫힘 없는 <Icon> 태그 감지 → ${tag}`);
    });

    return errors;
  };

  useEffect(() => {
    setSourceErrors(validateText(sourceText));
    setTargetErrors(validateText(targetText));
  }, [sourceText, targetText]);

  function highlightCharWidth(char: string, i: string | number) {
    const fullWidthPunctuations = "、。！？：；「」『』【】";
    const halfWidthNumbers = /[0-9]/;
    const halfWidthParens = /[\[\]\(\)\{\}〈〉《》〔〕]/;
    const halfWidthSymbols = /[+\-]/;

    if (fullWidthPunctuations.includes(char)) {
      return (
        <span key={i} className="inline-block bg-green-100 text-green-800 font-bold px-1 rounded" title="전각 기호 (Full-width)">
          {char}
        </span>
      );
    } else if (halfWidthNumbers.test(char)) {
      return (
        <span key={i} className="inline-block bg-blue-100 text-blue-800 px-1 rounded" title="반각 숫자">
          {char}
        </span>
      );
    } else if (halfWidthParens.test(char)) {
      return (
        <span key={i} className="inline-block bg-purple-100 text-purple-800 px-1 rounded" title="반각 괄호">
          {char}
        </span>
      );
    } else if (halfWidthSymbols.test(char)) {
      return (
        <span key={i} className="inline-block bg-pink-100 text-pink-800 font-semibold px-1 rounded" title="반각 기호">
          {char}
        </span>
      );
    } else {
      return <span key={i}>{char}</span>;
    }
  }

  const renderParsedText = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const regex = /<[^>]+>|[^<]+/g;
    const matches = text.match(regex);
    if (!matches) return text;

    matches.forEach((token, i) => {
      if (token.startsWith("<Icon")) {
        const keyMatch = token.match(/KeyAction=['"]([^'"]+)['"]?/);
        const idMatch = token.match(/UIKeySpecificIconId=['"]([^'"]+)['"]?/);
        const iconKeyMap: Record<string, string> = {
          WeaponSkill_Slot_Basic: "Z",
          WeaponSkill_Slot_Smite: "X",
          WeaponSkill_Slot_Dodge: "C",
          WeaponSkill_Slot_Defence: "V",
          "101": "Z",
          "103": "X",
        };

        const label = keyMatch
          ? iconKeyMap[keyMatch[1]] ?? "?"
          : idMatch
          ? iconKeyMap[idMatch[1]] ?? "?"
          : "?";

        parts.push(
          <kbd
            key={i}
            className="inline-block bg-gray-900 text-white text-sm px-2 py-0.5 rounded border border-gray-300 mx-0.5 shadow-sm"
            title="Icon Key"
          >
            {label}
          </kbd>
        );
      } else {
        const chars = token.split("");
        chars.forEach((char, j) => {
          if (showCharWidthRule) {
            parts.push(highlightCharWidth(char, `${i}-${j}`));
          } else {
            parts.push(<span key={`${i}-${j}`}>{char}</span>);
          }
        });
      }
    });

    return parts;
  };

  const renderText = (text: string) =>
    text.split(/\r?\n/).map((line, idx) => (
      <div key={idx}>{renderParsedText(line)}</div>
    ));

  return (
    <main className="p-8 bg-[#f8f9fa] min-h-screen text-gray-900">
      <title>BG Reflector</title>
      <div className="mb-4 flex items-center justify-between">
        <div className="space-x-4">
          <select className="border rounded px-2 py-1 bg-white shadow-sm">
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

          <label className="ml-4">
            <input
              type="checkbox"
              checked={showCharWidthRule}
              onChange={(e) => setShowCharWidthRule(e.target.checked)}
              className="mr-1"
            />
            Character Width Rules 적용
          </label>
        </div>
        <button
          className="bg-[#1a73e8] text-white px-4 py-2 rounded shadow hover:bg-[#1967d2]"
          onClick={() => {
            navigator.clipboard.writeText(targetText);
          }}
        >
          전체 복사
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-2">
        <div>
          <label className="font-bold">🟥 소스 입력 ({sourceText.split("\n").length}줄)</label>
          <SourceEditor value={sourceText} onChange={setSourceText} />
        </div>
        <div>
          <label className="font-bold">🟦 타겟 입력 ({targetText.split("\n").length}줄)</label>
          <SourceEditor value={targetText} onChange={setTargetText} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-4 text-sm text-red-600">
        <ul>
          {sourceErrors.length > 0 && <li className="font-bold mb-1">소스 유효성 오류:</li>}
          {sourceErrors.map((e, idx) => <li key={idx}>• {e}</li>)}
        </ul>
        <ul>
          {targetErrors.length > 0 && <li className="font-bold mb-1">타겟 유효성 오류:</li>}
          {targetErrors.map((e, idx) => <li key={idx}>• {e}</li>)}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-sm min-h-[120px]">
          <div className="text-sm text-gray-500 mb-1">소스 미리보기</div>
          <div>{renderText(sourceText)}</div>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-sm min-h-[120px]">
          <div className="text-sm text-gray-500 mb-1">타겟 미리보기</div>
          <div>{renderText(targetText)}</div>
        </div>
      </div>
    </main>
  );
}
