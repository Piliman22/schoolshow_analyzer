"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChartAnalyzer = exports.Note = exports.NoteTypes = void 0;
exports.getFlags = getFlags;
exports.main = main;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
var NoteTypes;
(function (NoteTypes) {
    NoteTypes[NoteTypes["SINGLE"] = 0] = "SINGLE";
    NoteTypes[NoteTypes["HOLD"] = 1] = "HOLD";
    NoteTypes[NoteTypes["FLICK"] = 2] = "FLICK";
    NoteTypes[NoteTypes["TRACE"] = 3] = "TRACE"; // トレースノーツ
})(NoteTypes || (exports.NoteTypes = NoteTypes = {}));
class Note {
    timing;
    holds;
    uid;
    flags;
    rawFlags;
    constructor(timing, holds, uid, flags, rawFlags) {
        this.timing = timing;
        this.holds = holds;
        this.uid = uid;
        this.flags = flags;
        this.rawFlags = rawFlags;
    }
    get noteTypeName() {
        const map = {
            [NoteTypes.SINGLE]: "Single(Tap)",
            [NoteTypes.HOLD]: "Hold",
            [NoteTypes.FLICK]: "Flick",
            [NoteTypes.TRACE]: "Trace"
        };
        return map[this.flags.noteType] ?? `Unknown(${this.flags.noteType})`;
    }
    get hasHolds() {
        return this.holds.length > 0;
    }
}
exports.Note = Note;
function getFlags(val) {
    // val は 32bit整数を想定
    const noteType = (val & 0xF);
    const r1 = (val >>> 4) & 0x3F;
    const r2 = (val >>> 10) & 0x3F;
    const l1 = (val >>> 16) & 0x3F;
    const l2 = (val >>> 22) & 0x3F;
    return {
        noteType,
        r1,
        r2,
        l1,
        l2,
        get width() {
            return this.r1 - this.l1;
        },
        get positionRange() {
            return `${this.l1}-${this.r1}`;
        }
    };
}
class ChartAnalyzer {
    filePath;
    notes = [];
    bpms = [];
    offset = 0;
    beats = [];
    constructor(jsonFilePath) {
        this.filePath = jsonFilePath;
    }
    loadChart() {
        try {
            const raw = fs.readFileSync(this.filePath, { encoding: "utf-8" });
            const data = JSON.parse(raw);
            this.bpms = Array.isArray(data.Bpms) ? data.Bpms : [];
            this.offset = typeof data.Offset === "number" ? data.Offset : parseFloat(String(data.Offset || 0)) || 0;
            this.beats = Array.isArray(data.Beats) ? data.Beats : [];
            const notesData = Array.isArray(data.Notes) ? data.Notes : [];
            for (const nd of notesData) {
                if (nd && typeof nd === "object" && "Flags" in nd) {
                    const timing = parseFloat(String(nd.just ?? nd.timing ?? 0)) || 0;
                    const holds = Array.isArray(nd.holds) ? nd.holds.map((h) => parseFloat(String(h) || "0")) : [];
                    const uid = typeof nd.Uid === "number" ? nd.Uid : parseInt(String(nd.Uid || "0"), 10) || 0;
                    const rawFlags = Number(nd.Flags) >>> 0;
                    const flags = getFlags(rawFlags);
                    this.notes.push(new Note(timing, holds, uid, flags, rawFlags));
                }
            }
            // ソート（タイミング順）しておく
            this.notes.sort((a, b) => a.timing - b.timing);
            return true;
        }
        catch (e) {
            console.error("エラー: 譜面ファイルの読み込みに失敗しました -", e);
            return false;
        }
    }
    analyzeNote(note) {
        return {
            timing: note.timing,
            uid: note.uid,
            type: note.noteTypeName,
            raw_flags: `0x${(note.rawFlags >>> 0).toString(16).toUpperCase().padStart(8, "0")}`,
            position: note.flags.positionRange,
            width: note.flags.width,
            has_holds: note.hasHolds,
            hold_count: note.holds.length,
            flags_detail: {
                note_type: note.flags.noteType,
                l1: note.flags.l1,
                r1: note.flags.r1,
                l2: note.flags.l2,
                r2: note.flags.r2
            }
        };
    }
    getStatistics() {
        if (this.notes.length === 0)
            return {};
        const typeCounts = new Map([
            [NoteTypes.SINGLE, 0],
            [NoteTypes.HOLD, 0],
            [NoteTypes.FLICK, 0],
            [NoteTypes.TRACE, 0]
        ]);
        for (const n of this.notes) {
            typeCounts.set(n.flags.noteType, (typeCounts.get(n.flags.noteType) || 0) + 1);
        }
        const totalNotes = this.notes.length;
        const duration = totalNotes > 0 ? Math.max(...this.notes.map(n => n.timing)) : 0;
        // 同時押し検出（同タイミングをグループ化）
        const timingGroups = new Map();
        for (const n of this.notes) {
            const key = n.timing.toFixed(6);
            const arr = timingGroups.get(key) ?? [];
            arr.push(n);
            timingGroups.set(key, arr);
        }
        const simultaneousNotes = [];
        for (const [k, group] of timingGroups) {
            if (group.length > 1) {
                simultaneousNotes.push({
                    timing: parseFloat(k),
                    count: group.length,
                    notes: group.map(x => x.uid)
                });
            }
        }
        return {
            total_notes: totalNotes,
            duration,
            note_type_counts: {
                Single: typeCounts.get(NoteTypes.SINGLE) ?? 0,
                Hold: typeCounts.get(NoteTypes.HOLD) ?? 0,
                Flick: typeCounts.get(NoteTypes.FLICK) ?? 0,
                Trace: typeCounts.get(NoteTypes.TRACE) ?? 0
            },
            simultaneous_count: simultaneousNotes.length,
            bpm_info: this.bpms,
            beat_info: this.beats,
            offset: this.offset
        };
    }
    printAnalysis(maxNotes = 50) {
        if (this.notes.length === 0) {
            console.log("ノーツデータがありません");
            return;
        }
        console.log(`=== 譜面分析結果: ${path.basename(this.filePath)} ===\n`);
        const stats = this.getStatistics();
        console.log("【統計情報】");
        console.log(`総ノーツ数: ${stats.total_notes}`);
        console.log(`楽曲長: ${stats.duration.toFixed(2)}秒`);
        console.log(`BPM: ${stats.bpm_info && stats.bpm_info.length ? stats.bpm_info[0].Bpm : "N/A"}`);
        console.log(`拍子: ${stats.beat_info && stats.beat_info.length ? `${stats.beat_info[0].Numerator}/${stats.beat_info[0].Denominator}` : "N/A"}`);
        console.log(`オフセット: ${stats.offset}`);
        console.log();
        console.log("【ノーツタイプ別集計】");
        for (const [k, v] of Object.entries(stats.note_type_counts)) {
            const percentage = stats.total_notes > 0 ? (v / stats.total_notes) * 100 : 0;
            console.log(`${k}: ${v}個 (${percentage.toFixed(1)}%)`);
        }
        console.log();
        console.log(`【同時押し】: ${stats.simultaneous_count}箇所`);
        console.log();
        console.log(`【ノーツ詳細】(最初の${maxNotes}個)`);
        console.log("Time\t\tUID\tType\t\tFlags\t\tPosition\tWidth");
        console.log("-".repeat(80));
        for (let i = 0; i < Math.min(this.notes.length, maxNotes); i++) {
            const note = this.notes[i];
            if (!note)
                continue;
            const analysis = this.analyzeNote(note);
            console.log(`${analysis.timing.toFixed(6)}\t${analysis.uid}\t${analysis.type.padEnd(12)}\t${analysis.raw_flags}\t${analysis.position}\t${analysis.width}`);
            if (analysis.has_holds) {
                console.log(`\t\t\t\t-> Hold終了: ${note.holds.join(", ")}`);
            }
        }
        if (this.notes.length > maxNotes) {
            console.log(`... (残り ${this.notes.length - maxNotes} ノーツ)`);
        }
    }
    exportToCsv(outputPath) {
        const header = ['timing', 'uid', 'type', 'raw_flags', 'hex_flags', 'l1', 'r1', 'l2', 'r2', 'position', 'width', 'holds'];
        const lines = [];
        lines.push(header.join(","));
        for (const note of this.notes) {
            const hex = `0x${(note.rawFlags >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
            const row = [
                note.timing,
                note.uid,
                `"${note.noteTypeName}"`,
                note.rawFlags,
                hex,
                note.flags.l1,
                note.flags.r1,
                note.flags.l2,
                note.flags.r2,
                `"${note.flags.positionRange}"`,
                note.flags.width,
                `"${note.holds.join(";")}"`
            ].join(",");
            lines.push(row);
        }
        fs.writeFileSync(outputPath, lines.join("\r\n"), { encoding: "utf-8" });
    }
}
exports.ChartAnalyzer = ChartAnalyzer;
function main() {
    const chartFiles = [
        path.join("example", "rhythmgame_chart_103103_01.bytes.json"),
        path.join("example", "rhythmgame_chart_103103_02.bytes.json"),
        path.join("example", "rhythmgame_chart_103103_03.bytes.json"),
        path.join("example", "rhythmgame_chart_103103_04.bytes.json")
    ];
    for (const chartFile of chartFiles) {
        if (fs.existsSync(chartFile)) {
            console.log("\n" + "=".repeat(60));
            const analyzer = new ChartAnalyzer(chartFile);
            if (analyzer.loadChart()) {
                analyzer.printAnalysis(30);
                const csvOutput = chartFile.replace(/\.json$/i, "_analysis.csv");
                analyzer.exportToCsv(csvOutput);
                console.log(`\nCSV出力: ${csvOutput}`);
            }
            else {
                console.log(`ファイル読み込みエラー: ${chartFile}`);
            }
        }
        else {
            console.log(`ファイルが見つかりません: ${chartFile}`);
        }
    }
}
if (require.main === module) {
    main();
}
