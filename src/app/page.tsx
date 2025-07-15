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
  }, [value, onChange]);

  return <div ref={editorRef} className="border rounded shadow bg-white h-40 overflow-auto" />;
}

function validateText(text: string): string[] {
  const lines = text.split("\n");
  const errors: string[] = [];

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    const openTags = (line.match(/<FontStyle[^>]*?>/g) || []).length;
    const closeTags = (line.match(/<\/FontStyle>/g) || []).length;
    if (openTags !== closeTags) {
      errors.push(`${lineNum}줄: <FontStyle> 태그 쌍이 맞지 않음`);
    }

    const emptyTagPatterns = [
      /<param\b[^<>]*?\/>/g,
      /<alias\b[^<>]*?\/>/g,
      /<PlayerName\s*\/>/g,
      /<Icon[^>]*?\/>/g,
      /<cms[^>]*?\/>/g
    ];

    emptyTagPatterns.forEach((regex) => {
      const matches = line.match(regex) || [];
      matches.forEach((tag) => {
        if (!/<[^<>]+\/>$/.test(tag)) {
          errors.push(`${lineNum}줄: 닫히지 않은 태그 감지됨 → ${tag}`);
        }
      });
    });
  });

  return errors;
}

function findIconTagIssues(source: string, target: string): string[] {
  const errors: string[] = [];
  const iconTagRegex = /<Icon[^>]*?\/>/g;
  const sourceIcons: string[] = source.match(iconTagRegex) || [];
  const targetIcons: string[] = target.match(iconTagRegex) || [];

  sourceIcons.forEach((sourceTag) => {
    const lineNum = source.split("\n").findIndex((line) => line.includes(sourceTag)) + 1;
    const matched = targetIcons.includes(sourceTag);
    if (!matched) {
      errors.push(`${lineNum}줄: 타겟에서 정확히 일치하는 <Icon> 태그 누락 또는 변형됨 → ${sourceTag}`);
    }
  });

  return errors;
}

function renderParsedText(text: string, showHidden: boolean, showWidthRule: boolean): React.ReactNode {
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
          title={keyMatch?.[1] || idMatch?.[1] || ""}
          className="inline-block bg-gray-900 text-white text-sm px-2 py-0.5 rounded border border-gray-300 mx-0.5 shadow-sm"
        >
          {label}
        </kbd>
      );
    } else {
      const visible = showHidden
        ? token.replace(/ /g, "␣").replace(/\t/g, "→").replace(/\r/g, "␍").replace(/\n/g, "␊")
        : token;
      const rendered = showWidthRule
        ? Array.from(visible).map((char, j) => {
            const isHalf = /[0-9\[\]\(\)\{\}〈〉《》〔〕\+\-]/.test(char);
            const isFull = /[、。！？：；「」『』【】]/.test(char);
            const style = isFull
              ? "bg-green-100 text-green-700 font-semibold px-0.5 rounded-sm"
              : isHalf
              ? "bg-blue-100 text-blue-700 px-0.5 rounded-sm"
              : "";
            const tooltip = isFull
              ? "전각 문자 (Full-width)"
              : isHalf
              ? "반각 문자 (Half-width)"
              : "";
            return (
              <span key={`${i}-${j}`} className={style} title={tooltip}>
                {char}
              </span>
            );
          })
        : visible;
      parts.push(<span key={i}>{rendered}</span>);
    }
  });

  return parts;
}

export default function Home() {
  const [sourceText, setSourceText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [showLineBreaks, setShowLineBreaks] = useState(false);
  const [showHiddenChars, setShowHiddenChars] = useState(false);
  const [showCharWidth, setShowCharWidth] = useState(false);
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);
  const [targetErrors, setTargetErrors] = useState<string[]>([]);

  useEffect(() => {
    setSourceErrors(validateText(sourceText));
    const baseErrors = validateText(targetText);
    const iconIssues = findIconTagIssues(sourceText, targetText);
    setTargetErrors([...baseErrors, ...iconIssues]);
  }, [sourceText, targetText]);

  const renderText = (text: string) =>
    text.split(/\r?\n/).map((line, idx) => (
      <div key={idx}>{renderParsedText(line, showHiddenChars, showCharWidth)}</div>
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
              checked={showHiddenChars}
              onChange={(e) => setShowHiddenChars(e.target.checked)}
              className="mr-1"
            />
            공백/개행 문자 표시
          </label>

          <label className="ml-4">
            <input
              type="checkbox"
              checked={showCharWidth}
              onChange={(e) => setShowCharWidth(e.target.checked)}
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