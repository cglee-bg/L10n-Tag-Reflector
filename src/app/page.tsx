/* MIR4 태그 유효성 검사 및 통계 포함 - BG Reflector 개선 */

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

function countTagStats(text: string): Record<string, number> {
  const stats = {
    Icon: 0,
    param: 0,
    alias: 0,
    PlayerName: 0,
    cms: 0,
    FontStyleOpen: 0,
    FontStyleClose: 0,
    SpanColor: 0,
    CurlyBraces: 0,
    HexRef: 0,
  };
  const lines = text.split("\n");
  lines.forEach((line) => {
    stats.Icon += (line.match(/<Icon[^>]*?\/>/g) || []).length;
    stats.param += (line.match(/<param[^>]*?\/>/g) || []).length;
    stats.alias += (line.match(/<alias[^>]*?\/>/g) || []).length;
    stats.PlayerName += (line.match(/<PlayerName\s*\/>/g) || []).length;
    stats.cms += (line.match(/<cms[^>]*?\/>/g) || []).length;
    stats.FontStyleOpen += (line.match(/<FontStyle[^>]*?>/g) || []).length;
    stats.FontStyleClose += (line.match(/<\/FontStyle>/g) || []).length;
    stats.SpanColor += (line.match(/<span color=\"#[A-Za-z0-9]+\">/gi) || []).length;
    stats.CurlyBraces += (line.match(/\{\d+\}/g) || []).length;
    stats.HexRef += (line.match(/<[A-F0-9]{8}>/g) || []).length;
  });
  return stats;
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
      /<cms[^>]*?\/>/g,
    ];

    emptyTagPatterns.forEach((regex) => {
      const matches = line.match(regex) || [];
      matches.forEach((tag) => {
        if (!/<[^<>]+\/>$/.test(tag)) {
          errors.push(`${lineNum}줄: 닫히지 않은 태그 감지됨 → ${tag}`);
        }
      });
    });

    const spanOpen = (line.match(/<span color=\"#[A-Za-z0-9]+\">/gi) || []).length;
    const spanClose = (line.match(/<\/>/g) || []).length;
    if (spanOpen !== spanClose) {
      errors.push(`${lineNum}줄: <span> 태그와 </> 수 불일치`);
    }
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
    } else if (token.match(/^<span color=\"#[A-Za-z0-9]+\">/gi)) {
      const colorMatch = token.match(/#[A-Za-z0-9]+/);
      const color = colorMatch ? colorMatch[0] : "#000";
      parts.push(
        <span key={i} style={{ color, fontWeight: "bold" }}>
          {/* open span 태그는 렌더링에서 스킵, 다음 텍스트에서 적용됨 */}
        </span>
      );
    } else if (token === "</>") {
      parts.push(<span key={i}></span>);
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

// 커밋 명령:
// git add .
// git commit -m "Add MIR4 span color rendering and close tag support"
// git push origin main
