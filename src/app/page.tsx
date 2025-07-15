"use client";

import { useState, useEffect, useRef } from "react";
import React from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { html } from "@codemirror/lang-html";

function countTagStats(text: string): Record<string, number> {
  const stats = {
    Icon: 0,
    param: 0,
    alias: 0,
    PlayerName: 0,
    cms: 0,
    FontStyleOpen: 0,
    FontStyleClose: 0
  };
  const lines = text.split("\n");
  lines.forEach(line => {
    stats.Icon += (line.match(/<Icon[^>]*?\/>/g) || []).length;
    stats.param += (line.match(/<param[^>]*?\/>/g) || []).length;
    stats.alias += (line.match(/<alias[^>]*?\/>/g) || []).length;
    stats.PlayerName += (line.match(/<PlayerName\s*\/>/g) || []).length;
    stats.cms += (line.match(/<cms[^>]*?\/>/g) || []).length;
    stats.FontStyleOpen += (line.match(/<FontStyle[^>]*?>/g) || []).length;
    stats.FontStyleClose += (line.match(/<\/FontStyle>/g) || []).length;
  });
  return stats;
}

export default function Home() {
  const [sourceText, setSourceText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [showLineBreaks, setShowLineBreaks] = useState(false);
  const [showHiddenChars, setShowHiddenChars] = useState(false);
  const [showCharWidth, setShowCharWidth] = useState(false);
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);
  const [targetErrors, setTargetErrors] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(true);
  const [showStats, setShowStats] = useState(false);

  const sourceStats = countTagStats(sourceText);
  const targetStats = countTagStats(targetText);

  useEffect(() => {
    const sourceLines = sourceText.split("\n").length;
    const targetLines = targetText.split("\n").length;

    const baseSourceErrors = validateText(sourceText);
    const baseTargetErrors = validateText(targetText);
    const iconIssues = findIconTagIssues(sourceText, targetText);

    const lineMismatch = sourceLines !== targetLines
      ? [`⚠ 줄 수 불일치: 소스 ${sourceLines}줄, 타겟 ${targetLines}줄`]
      : [];

    setSourceErrors(baseSourceErrors);
    setTargetErrors([...baseTargetErrors, ...iconIssues, ...lineMismatch]);
  }, [sourceText, targetText]);

  return (
    <div className="p-4">
      <div className="mb-4">
        <button
          className="bg-blue-100 text-blue-800 px-3 py-1 rounded mr-2"
          onClick={() => setShowStats(!showStats)}
        >
          {showStats ? "통계 숨기기" : "태그 통계 보기"}
        </button>
      </div>

      {showStats && (
        <div className="mb-4 p-3 border border-gray-300 rounded bg-gray-50 text-sm">
          <strong>소스 태그 통계:</strong><br />
          Icon: {sourceStats.Icon}, param: {sourceStats.param}, alias: {sourceStats.alias}, PlayerName: {sourceStats.PlayerName}, cms: {sourceStats.cms}, FontStyle 열기: {sourceStats.FontStyleOpen}, 닫기: {sourceStats.FontStyleClose}<br /><br />
          <strong>타겟 태그 통계:</strong><br />
          Icon: {targetStats.Icon}, param: {targetStats.param}, alias: {targetStats.alias}, PlayerName: {targetStats.PlayerName}, cms: {targetStats.cms}, FontStyle 열기: {targetStats.FontStyleOpen}, 닫기: {targetStats.FontStyleClose}
        </div>
      )}

      {/* 기존 UI는 그대로 유지됨 */}
    </div>
  );
}
