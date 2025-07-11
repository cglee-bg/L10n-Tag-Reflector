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

  return <div ref={editorRef} className="border rounded shadow-sm bg-white h-40 overflow-auto" />;
}

export default function Home() {
  const [sourceText, setSourceText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [showLineBreaks, setShowLineBreaks] = useState(false);
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);
  const [targetErrors, setTargetErrors] = useState<string[]>([]);

  const validateText = (text: string): string[] => {
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
          if (!/\/\s*>$/.test(tag)) {
            errors.push(`${lineNum}줄: 닫히지 않은 태그 감지됨 → ${tag}`);
          }
        });
      });
    });

    return errors;
  };

  useEffect(() => {
    setSourceErrors(validateText(sourceText));
    setTargetErrors(validateText(targetText));
  }, [sourceText, targetText]);

  const renderParsedText = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const regex = /<[^>]+>|%[YmdHM]|\\r|\\n|[^<%\\r\\n]+/g;
    const matches = text.match(regex);
    if (!matches) return text;

    const fontStack: string[] = [];

    matches.forEach((token, i) => {
      if (token === "\\n") {
        parts.push(<br key={i} />);
        return;
      }

      const dateMap: Record<string, string> = {
        "%Y": "2025",
        "%m": "07",
        "%d": "11",
        "%H": "14",
        "%M": "30",
      };
      if (token in dateMap) {
        parts.push(<span key={i}>{dateMap[token]}</span>);
        return;
      }

      const keyMatch = token.match(/KeyAction=['"]([^'"]+)['"]?/);
      const idMatch = token.match(/UIKeySpecificIconId=['"]([^'"]+)['"]?/);
      if (token.startsWith("<Icon")) {
        const iconKeyMap: Record<string, string> = {
          WeaponSkill_Slot_Basic: "Z",
          WeaponSkill_Slot_Smite: "X",
          WeaponSkill_Slot_Dodge: "C",
          WeaponSkill_Slot_Defence: "V",
        };
        const iconIdMap: Record<string, string> = {
          "101": "Z",
          "103": "X",
        };

        const label = keyMatch
          ? iconKeyMap[keyMatch[1]] ?? "?"
          : idMatch
          ? iconIdMap[idMatch[1]] ?? "?"
          : "?";

        parts.push(
          <kbd
            key={i}
            className="inline-block bg-black text-white text-sm px-2 py-0.5 rounded border border-gray-400 mx-0.5"
            title="e.g., key, button, icon"
          >
            {label}
          </kbd>
        );
        return;
      }

      const paramMatch = token.match(/<param[^>]*Name=['"]([^'"]+)['"][^>]*\/>/);
      if (paramMatch) {
        parts.push(
          <span
            key={i}
            className="inline-block bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded mx-0.5 text-sm"
            title="name, value"
          >
            {`{${paramMatch[1]}}`}
          </span>
        );
        return;
      }

      if (token.match(/<PlayerName\s*\/>/)) {
        parts.push(
          <span
            key={i}
            className="inline-block bg-purple-200 text-purple-800 px-2 py-0.5 rounded mx-0.5 text-sm"
            title="player name"
          >
            플레이어
          </span>
        );
        return;
      }

      const aliasMatch = token.match(/<alias[^>]*Name=['"]([^'"]+)['"][^>]*\/>/);
      if (aliasMatch) {
        parts.push(
          <span
            key={i}
            className="text-blue-700 font-medium mx-0.5"
            title="alias name"
          >
            {aliasMatch[1]}
          </span>
        );
        return;
      }

      const cmsMatch = token.match(/<cms[^>]*Name=['"]([^'"]+)['"][^>]*\/>/);
      if (cmsMatch) {
        parts.push(
          <span
            key={i}
            className="inline-block bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded mx-0.5 text-sm font-semibold border border-yellow-300"
            title="quest name, system term"
          >
            「{cmsMatch[1]}」
          </span>
        );
        return;
      }

      const openFont = token.match(/<FontStyle[^>]*name=['"]([^'"]+)['"][^>]*>/);
      if (openFont) {
        fontStack.push(openFont[1]);
        return;
      }

      if (token === "</FontStyle>") {
        fontStack.pop();
        return;
      }

      let className = "";
      if (fontStack.includes("Bold")) className += " font-bold";
      if (fontStack.includes("Red")) className += " text-red-600";
      if (fontStack.includes("grade_rare")) className += " text-indigo-600 font-semibold";
      parts.push(<span key={i} className={className}>{token}</span>);
    });

    return parts;
  };

  const renderText = (text: string) =>
    text.split(/\r?\n/).map((line, idx) => (
      <div key={idx}>{renderParsedText(line)}</div>
    ));

  return (
    <main className="p-8 bg-gray-100 min-h-screen text-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <div className="space-x-4">
          <select className="border rounded px-2 py-1">
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
          className="bg-blue-600 text-white px-4 py-2 rounded shadow"
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
