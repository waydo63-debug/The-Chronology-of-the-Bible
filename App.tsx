import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronLeft, Check, ChevronRight, BookOpen, ArrowRight, Trophy, Calendar, Settings, User, Plus, X, UserPlus, Cloud, CloudOff, RefreshCw, Save, Loader2, Table, Link, FileSearch, AlertCircle } from 'lucide-react';
import { RAW_BIBLE_DATA } from './planData';
import { DEFAULT_BIBLE_TEXT } from './bibleText';

// --- Constants ---

// 사용자가 제공한 첫 번째 URL을 나머지 슬롯에도 기본값으로 적용하여 활성화합니다.
// 실제 사용 시에는 2~7번째 URL을 각 성경 파트에 맞는 주소로 변경해야 합니다.
const DEFAULT_CSV_URLS = [
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTOMBsNZHs_X1clBlp50RM_g_14I-LKnMRQGiL3Ovv9LskiKK6wfKPhZBRPiIyumu22Uycp9T33sMXU/pub?output=csv",
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7u9wDMzkp3efTGBj02G4uKCEuKCOt5IRptAa2fy-Kl4DA_VQ2OBA8K1mW2osFkhXwUJODV1c5aSuE/pub?output=csv",
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQTHEE0z5lXcPMAnLyYNklluCUIpNOlGowtXjV2eJaTzkRMvgIBlws9WQqqCX6rPUz_kOhmh2pwr2kr/pub?output=csv",
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTbWAQ8Y4mqS1YiNjOI4nSNmlLTz0mcdscZfunIwKUyJRv3XE-hr-0bY91K4lGWDZZr7CfLdnSN9QJk/pub?output=csv",
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRCaJLo8TPiBZeDTCiM-0mdHwHcoAsZzYNUXWhhephNbAWnsbGin5Dgf2MCWHFfkGTNFISo1IzB6xZH/pub?output=csv",
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTBerbsH9iM1YALnJk4ptkIYVLUYLW6sO1uz8mwCssqZoyBbrWPZeHga25xqpu_daCHYWeTiluKRDgS/pub?output=csv",
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRHi5_SaniAlV1fAGzvXVJIFkE7vaeUZjrH2SUOoBb6lEIkSwVctECdpN1e1R9kGjrEk0MnKkayRy04/pub?output=csv"
];

// --- Types ---

interface Chapter {
  id: string;
  book: string;
  chapter: number;
  title: string;
  content: string;
}

interface DayPlan {
  day: number;
  chapters: Chapter[];
}

interface ActiveReadingState {
  dayIndex: number;
  chapterIndex: number;
}

interface UserData {
  startDate: string;
  currentDay: number;
  completedChapters: Record<string, boolean>;
}

interface CsvConfig {
  urls: string[];
}

type ViewState = 'START' | 'DATE_SELECT' | 'LIST' | 'READING' | 'COMPLETION' | 'SETTINGS';

// --- Bible Data Processing Helpers ---

const BOOK_MAP: Record<string, string> = {
  "창세기": "창", "출애굽기": "출", "레위기": "레", "민수기": "민", "신명기": "신",
  "여호수아": "수", "사사기": "삿", "사시기": "삿", "룻기": "룻",
  "사무엘상": "삼상", "사무엘하": "삼하", "열왕기상": "왕상", "열왕기하": "왕하",
  "역대상": "대상", "역대하": "대하", "에스라": "스", "느헤미야": "느", "에스더": "에",
  "욥기": "욥", "시편": "시", "잠언": "잠", "전도서": "전", "아가": "아", "아가서": "아",
  "이사야": "사", "예레미야": "렘", "예레미야애가": "애", "에스겔": "겔", "다니엘": "단",
  "호세아": "호", "요엘": "욜", "아모스": "암", "오바댜": "옵", "요나": "욘", "미가": "미",
  "나훔": "나", "하박국": "합", "스바냐": "습", "학개": "학", "스가랴": "슥", "말라기": "말",
  "마태복음": "마", "마가복음": "막", "누가복음": "누", "요한복음": "요", "사도행전": "행",
  "로마서": "롬", "고린도전서": "고전", "고린도후서": "고후", "갈라디아서": "갈", "에베소서": "엡",
  "빌립보서": "빌", "골로새서": "골", "데살로니가전서": "살전", "데살로니가전": "살전",
  "데살로니가후서": "살후", "데살로니가후": "살후", "디모데전서": "딤전", "디모데후서": "딤후",
  "디도서": "딛", "빌레몬서": "몬", "히브리서": "히", "야고보서": "약",
  "베드로전서": "벧전", "베드로후서": "벧후", "요한일서": "요일", "요한이서": "요이", "요한삼서": "요삼",
  "유다서": "유", "요한계시록": "계"
};

// Robust CSV Line Splitter (Handles quotes containing commas)
const splitCsvRow = (row: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuote = false;
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      // Check for escaped quote ("")
      if (inQuote && row[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuote = !inQuote;
      }
    } else if (char === ',' && !inQuote) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

interface BibleParseResult {
  map: Map<string, Map<number, string>>;
  previewData: string[];
  totalVerses: number;
}

const processBibleTextSource = (sourceText: string): BibleParseResult => {
  const map = new Map<string, Map<number, string>>();
  const lines = sourceText.split(/\r?\n/);
  const previewData: string[] = [];
  let totalVerses = 0;

  // Detection logic for CSV column mapping
  let colMap = { book: -1, chapter: -1, verse: -1, text: -1 };
  let isSchemaDetected = false;

  const cleanBookName = (s: string) => s.replace(/^[0-9]+/, '').trim();
  const isValidBook = (s: string) => {
    const clean = cleanBookName(s.replace(/^"|"$/g, ''));
    return !!(BOOK_MAP[clean] || Object.values(BOOK_MAP).includes(clean));
  };

  const detectSchema = (parts: string[]) => {
    // Basic heuristics to identify columns
    const potentialMap = { book: -1, chapter: -1, verse: -1, text: -1 };
    
    parts.forEach((part, idx) => {
      const cleanPart = part.replace(/^"|"$/g, '');
      const numPart = parseInt(cleanPart, 10);
      const isNum = !isNaN(numPart);
      
      // Check for Book
      if (potentialMap.book === -1 && (BOOK_MAP[cleanPart] || Object.values(BOOK_MAP).includes(cleanPart))) {
        potentialMap.book = idx;
      }
      // Check for Chapter (1-150)
      else if (isNum && numPart > 0 && numPart <= 150 && potentialMap.chapter === -1) {
        potentialMap.chapter = idx;
      }
      // Check for Verse (1-176)
      else if (isNum && numPart > 0 && numPart <= 176 && potentialMap.verse === -1) {
        potentialMap.verse = idx;
      }
    });

    // Assume the longest remaining string is text
    let maxLength = 0;
    parts.forEach((part, idx) => {
      if (idx !== potentialMap.book && idx !== potentialMap.chapter && idx !== potentialMap.verse) {
        if (part.length > maxLength) {
          maxLength = part.length;
          potentialMap.text = idx;
        }
      }
    });

    return potentialMap;
  };

  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;

    // Skip potential headers
    if (cleanLine.startsWith('Book') || cleanLine.startsWith('book') || cleanLine.includes('성경') || (cleanLine.includes('장') && cleanLine.includes('절') && cleanLine.length < 50)) continue;

    let bookStr = '';
    let chapter = 0;
    let verse = '';
    let text = '';
    let success = false;

    // 1. Try CSV Parsing
    if (cleanLine.includes(',')) {
      const parts = splitCsvRow(cleanLine);
      
      // Strategy A: Check for "Book, Ref(Ch:Ver), Text" format (e.g. 01창, 1:1, text)
      // This handles cases where Chapter and Verse are in one column "1:1"
      const refIdx = parts.findIndex(p => /^\d+:\d+$/.test(p.trim().replace(/^"|"$/g, '')));
      
      if (refIdx !== -1) {
          const [c, v] = parts[refIdx].trim().replace(/^"|"$/g, '').split(':');
          
          // Find Book Column
          const bookIdx = parts.findIndex((p, i) => i !== refIdx && isValidBook(p));
          
          if (bookIdx !== -1) {
              bookStr = cleanBookName(parts[bookIdx].trim().replace(/^"|"$/g, ''));
              chapter = parseInt(c, 10);
              verse = v;
              
              // Find Text Column (longest remaining)
              let maxLen = -1;
              let textIdx = -1;
              parts.forEach((p, i) => {
                  if (i !== refIdx && i !== bookIdx) {
                      if (p.length > maxLen) {
                          maxLen = p.length;
                          textIdx = i;
                      }
                  }
              });
              
              if (textIdx !== -1) {
                  text = parts[textIdx];
                  success = true;
              }
          }
      }

      // Strategy B: Standard separate columns (fallback)
      if (!success) {
        // Auto-detect schema on first valid row
        if (!isSchemaDetected && parts.length >= 4) {
          const detected = detectSchema(parts);
          // If we found at least Book and Chapter, use this schema
          if (detected.book !== -1 && detected.chapter !== -1) {
            colMap = detected;
            isSchemaDetected = true;
            // If text column wasn't found (maybe short text), default to last column
            if (colMap.text === -1) colMap.text = parts.length - 1;
          } else {
             // Fallback default: Book, Chapter, Verse, Text
             colMap = { book: 0, chapter: 1, verse: 2, text: 3 };
             // If 5 cols (Index, Book...), shift
             if (parts.length >= 5 && !isNaN(parseInt(parts[2]))) {
               colMap = { book: 1, chapter: 2, verse: 3, text: 4 };
             }
             isSchemaDetected = true;
          }
        }

        if (isSchemaDetected && parts.length > Math.max(colMap.book, colMap.chapter, colMap.text)) {
          bookStr = parts[colMap.book] || '';
          chapter = parseInt(parts[colMap.chapter] || '0', 10);
          verse = parts[colMap.verse] || '';
          text = parts[colMap.text] || '';
          success = true;
        }
      }
    }

    // 2. Fallback to Regex Parsing
    if (!success) {
      const textMatch = cleanLine.match(/^(\d*?)([가-힣]+)\s+(\d+):(\d+)\s+(.*)$/);
      if (textMatch) {
        bookStr = textMatch[2];
        chapter = parseInt(textMatch[3], 10);
        verse = textMatch[4];
        text = textMatch[5];
        success = true;
      }
    }

    if (success && bookStr && !isNaN(chapter) && chapter > 0) {
      // Normalize Book Name
      // Handle cases where CSV has full name "창세기" or abbr "창" or "01창"
      const cleanName = cleanBookName(bookStr);
      const normBook = BOOK_MAP[cleanName] || (Object.values(BOOK_MAP).includes(cleanName) ? cleanName : null);

      if (normBook) {
        if (!map.has(normBook)) {
          map.set(normBook, new Map());
        }
        const bookChapters = map.get(normBook)!;
        const existing = bookChapters.get(chapter) || "";
        bookChapters.set(chapter, existing + `${verse}. ${text}\n\n`);
        
        totalVerses++;
        if (previewData.length < 3) {
          previewData.push(`[${normBook} ${chapter}:${verse}] ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`);
        }
      }
    }
  }

  return { map, previewData, totalVerses };
};

const parseBibleData = (contentMap: Map<string, Map<number, string>>): DayPlan[] => {
  const lines = RAW_BIBLE_DATA.split('\n');
  const days: DayPlan[] = [];
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const dayMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (!dayMatch) return;

    const dayNum = parseInt(dayMatch[1], 10);
    const contentString = dayMatch[2];
    
    const parts = contentString.split(',').map(s => s.trim());
    const chapters: Chapter[] = [];

    parts.forEach(part => {
      if (!part) return;

      const partMatch = part.match(/^([가-힣\s]+?)\s+([\d,-]+)$/);
      if (partMatch) {
        const bookName = partMatch[1].trim();
        const rangeStr = partMatch[2].trim();
        const bookAbbr = BOOK_MAP[bookName];

        let chapterNums: number[] = [];
        if (rangeStr.includes('-')) {
          const [start, end] = rangeStr.split('-').map(n => parseInt(n, 10));
          for (let i = start; i <= end; i++) chapterNums.push(i);
        } else if (rangeStr.includes(',')) {
          chapterNums = rangeStr.split(',').map(n => parseInt(n, 10));
        } else {
          chapterNums.push(parseInt(rangeStr, 10));
        }

        chapterNums.forEach(chNum => {
          let content = "";
          if (bookAbbr && contentMap.has(bookAbbr)) {
             const bookChapters = contentMap.get(bookAbbr)!;
             content = bookChapters.get(chNum) || `(본문이 없습니다. 데이터 파일에 ${bookName} ${chNum}장이 포함되어 있는지 확인해주세요.)`;
          } else {
             // More specific error message
             const hasBook = contentMap.has(bookAbbr || 'unknown');
             content = `(본문 없음 - ${bookName}(${bookAbbr}) 데이터를 찾을 수 없습니다. ${hasBook ? '성경책은 있으나 장이 없습니다.' : '성경책 데이터가 없습니다.'})`;
          }

          chapters.push({
            id: `d${dayNum}-${bookName}-${chNum}`,
            book: bookName,
            chapter: chNum,
            title: `${bookName} ${chNum}장`,
            content: content
          });
        });
      }
    });

    if (chapters.length > 0) {
      days.push({ day: dayNum, chapters });
    }
  });

  return days;
};

// --- Components ---

const App: React.FC = () => {
  // Global State
  const [users, setUsers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  
  // Data State
  const [bibleText, setBibleText] = useState<string>(DEFAULT_BIBLE_TEXT);
  const [csvConfig, setCsvConfig] = useState<CsvConfig>({ urls: DEFAULT_CSV_URLS });
  const [isLoadingBible, setIsLoadingBible] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [parsePreview, setParsePreview] = useState<string[]>([]);

  // App State (Derived from Current User)
  const [view, setView] = useState<ViewState>('START');
  const [startDate, setStartDate] = useState<string>('');
  const [currentDay, setCurrentDay] = useState<number>(1);
  const [completedChapters, setCompletedChapters] = useState<Record<string, boolean>>({});
  const [activeReading, setActiveReading] = useState<ActiveReadingState | null>(null);
  
  // UI State
  const [tempDate, setTempDate] = useState<string>('');
  const [newUserName, setNewUserName] = useState<string>('');
  const [settingsForm, setSettingsForm] = useState<CsvConfig>({ urls: DEFAULT_CSV_URLS });
  
  // Refs
  const dateListRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // --- Data Loading Logic ---

  useEffect(() => {
    // Users
    const storedUsers = localStorage.getItem('bibleApp_users');
    if (storedUsers) {
      try {
        setUsers(JSON.parse(storedUsers));
      } catch (e) {
        setUsers([]);
      }
    }
    // CSV Config
    const storedCsv = localStorage.getItem('bibleApp_csvConfig');
    if (storedCsv) {
      const config = JSON.parse(storedCsv);
      if (!config.urls || config.urls.length === 0) config.urls = [...DEFAULT_CSV_URLS];
      while (config.urls.length < 7) config.urls.push('');
      setCsvConfig(config);
      setSettingsForm(config);
    } else {
        // Use Defaults if no local storage
        setCsvConfig({ urls: DEFAULT_CSV_URLS });
        setSettingsForm({ urls: DEFAULT_CSV_URLS });
    }
  }, []);

  useEffect(() => {
    const fetchBibleData = async () => {
      const validUrls = csvConfig.urls.filter(url => url && url.trim() !== '');
      
      if (validUrls.length === 0) {
        setBibleText(DEFAULT_BIBLE_TEXT);
        setIsApiConnected(false);
        setParsePreview([]);
        return;
      }

      setIsLoadingBible(true);
      setApiError(null);

      try {
        const responses = await Promise.all(
          validUrls.map(async (url, index) => {
             try {
               const res = await fetch(url);
               if (!res.ok) throw new Error(`파일 #${index + 1} 로드 실패`);
               return await res.text();
             } catch (e) {
               throw new Error(`파일 #${index + 1} 연결 실패: URL을 확인해주세요.`);
             }
          })
        );
        
        const combinedText = responses.join('\n');
        
        if (combinedText.length < 100) {
           throw new Error("가져온 데이터가 너무 짧거나 올바르지 않습니다.");
        }

        setBibleText(combinedText);
        setIsApiConnected(true);
      } catch (error: any) {
        console.error("CSV Fetch Error:", error);
        setApiError(error.message || "데이터를 불러오는데 실패했습니다.");
        setBibleText(DEFAULT_BIBLE_TEXT);
        setIsApiConnected(false);
      } finally {
        setIsLoadingBible(false);
      }
    };

    fetchBibleData();
  }, [csvConfig]);

  // Memoize the heavy parsing logic
  const { bibleContentMap, dataStats, previewList } = useMemo(() => {
     const result = processBibleTextSource(bibleText);
     const stats = `총 ${result.map.size}권, 약 ${result.totalVerses}절 로드됨`;
     return { 
       bibleContentMap: result.map, 
       dataStats: stats,
       previewList: result.previewData
     };
  }, [bibleText]);
  
  // Update preview state when parsing completes
  useEffect(() => {
    setParsePreview(previewList);
  }, [previewList]);

  const biblePlan = useMemo(() => parseBibleData(bibleContentMap), [bibleContentMap]);

  // Save Current User Data Whenever it Changes
  useEffect(() => {
    if (currentUser) {
      const data: UserData = {
        startDate,
        currentDay,
        completedChapters
      };
      localStorage.setItem(`bibleApp_user_${currentUser}`, JSON.stringify(data));
    }
  }, [currentUser, startDate, currentDay, completedChapters]);

  // Handle View specific effects
  useEffect(() => {
    if (view === 'DATE_SELECT') {
      setTempDate(startDate || new Date().toISOString().split('T')[0]);
    }
  }, [view, startDate]);

  useEffect(() => {
    if (view === 'LIST' && dateListRef.current) {
      const selectedEl = dateListRef.current.querySelector(`[data-day="${currentDay}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentDay, view]);

  // --- User Management ---

  const handleCreateUser = () => {
    const name = newUserName.trim();
    if (!name) return;

    if (users.includes(name)) {
      handleSelectUser(name);
      return;
    }

    const updatedUsers = [...users, name];
    setUsers(updatedUsers);
    localStorage.setItem('bibleApp_users', JSON.stringify(updatedUsers));
    
    // Set initial state for new user
    setCurrentUser(name);
    setStartDate('');
    setCompletedChapters({});
    setCurrentDay(1);
    
    setView('DATE_SELECT');
    setNewUserName('');
  };

  const handleSelectUser = (name: string) => {
    setCurrentUser(name);
    const storedData = localStorage.getItem(`bibleApp_user_${name}`);
    
    if (storedData) {
      try {
        const data: UserData = JSON.parse(storedData);
        setStartDate(data.startDate || '');
        setCompletedChapters(data.completedChapters || {});
        
        const savedDay = data.currentDay || 1;
        setCurrentDay(savedDay > biblePlan.length ? 1 : savedDay);
        
        if (data.startDate) {
          setView('LIST');
        } else {
          setView('DATE_SELECT');
        }
      } catch (e) {
        setStartDate('');
        setCompletedChapters({});
        setCurrentDay(1);
        setView('DATE_SELECT');
      }
    } else {
      setStartDate('');
      setCompletedChapters({});
      setCurrentDay(1);
      setView('DATE_SELECT');
    }
  };

  const handleDeleteUser = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`'${name}' 사용자의 모든 기록을 삭제하시겠습니까?`)) {
      const updatedUsers = users.filter(u => u !== name);
      setUsers(updatedUsers);
      localStorage.setItem('bibleApp_users', JSON.stringify(updatedUsers));
      localStorage.removeItem(`bibleApp_user_${name}`);
      
      if (currentUser === name) {
        setCurrentUser(null);
        setView('START');
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('START');
  };

  // --- Settings Logic ---

  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...settingsForm.urls];
    newUrls[index] = value;
    setSettingsForm(prev => ({ ...prev, urls: newUrls }));
  };

  const saveSettings = () => {
    setCsvConfig(settingsForm);
    localStorage.setItem('bibleApp_csvConfig', JSON.stringify(settingsForm));
  };

  const clearSettings = () => {
    const defaults = { urls: DEFAULT_CSV_URLS };
    setSettingsForm(defaults);
    setCsvConfig(defaults);
    localStorage.removeItem('bibleApp_csvConfig');
  };

  const resetProgress = () => {
    if(confirm('이 사용자의 모든 읽기 기록을 초기화하시겠습니까?')) {
      setStartDate('');
      setCompletedChapters({});
      setCurrentDay(1);
      setView('DATE_SELECT');
    }
  };

  // --- Date Picker Logic ---

  const handleDateConfirm = () => {
    const dateToSave = tempDate || new Date().toISOString().split('T')[0];
    setStartDate(dateToSave);
    setView('LIST');
  };

  const openDatePicker = () => {
    if (dateInputRef.current) {
      try {
        dateInputRef.current.showPicker();
      } catch (e) {
        dateInputRef.current.focus();
      }
    }
  };

  // --- Reading Logic ---

  const toggleChapterCompletion = (chapterId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCompletedChapters(prev => {
      const newMap = { ...prev };
      newMap[chapterId] = !newMap[chapterId];
      return newMap;
    });
  };

  const markChapterAsRead = (chapterId: string) => {
    setCompletedChapters(prev => ({ ...prev, [chapterId]: true }));
  };

  const openReading = (dayIndex: number, chapterIndex: number) => {
    setActiveReading({ dayIndex, chapterIndex });
    setView('READING');
  };

  const handleReadingNext = () => {
    if (!activeReading) return;
    const currentDayData = biblePlan[activeReading.dayIndex];
    const currentChapter = currentDayData.chapters[activeReading.chapterIndex];
    markChapterAsRead(currentChapter.id);

    if (activeReading.chapterIndex < currentDayData.chapters.length - 1) {
      setActiveReading({ 
        dayIndex: activeReading.dayIndex, 
        chapterIndex: activeReading.chapterIndex + 1 
      });
      window.scrollTo(0, 0);
    } else {
      setView('COMPLETION');
    }
  };

  const calculateTotalProgress = () => {
    let totalChapters = 0;
    let readChapters = 0;
    biblePlan.forEach(day => {
      day.chapters.forEach(ch => {
        totalChapters++;
        if (completedChapters[ch.id]) readChapters++;
      });
    });
    if (totalChapters === 0) return 0;
    return Math.round((readChapters / totalChapters) * 100);
  };

  const getDisplayDate = (dayOffset: number) => {
    if (!startDate) return `Day ${dayOffset}`;
    const date = new Date(startDate);
    date.setDate(date.getDate() + (dayOffset - 1));
    return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  };

  const getDisplayDateShort = (dayOffset: number) => {
    if (!startDate) return `${dayOffset}`;
    const date = new Date(startDate);
    date.setDate(date.getDate() + (dayOffset - 1));
    return `${date.getMonth() + 1}.${date.getDate()}`;
  };

  // --- Views ---

  if (view === 'START') {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        {/* Decorative background blobs */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 translate-x-1/2 translate-y-1/2"></div>

        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl shadow-emerald-500/10 w-full max-w-sm border border-white/50 relative z-10 flex flex-col h-[80vh] max-h-[700px]">
          
          {/* Header */}
          <div className="flex-none mb-8">
            <div className="bg-emerald-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner relative">
              <BookOpen size={32} className="text-emerald-600" />
              {isApiConnected && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center">
                  <Cloud size={10} className="text-white" />
                </div>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2 tracking-tight">연대기 성경읽기</h1>
            <p className="text-gray-500 text-sm">
              {biblePlan.length}일 완성 여정
            </p>
          </div>

          {/* User Input Section */}
          <div className="flex-none mb-6">
             <div className="relative">
               <input
                 type="text"
                 value={newUserName}
                 onChange={(e) => setNewUserName(e.target.value)}
                 placeholder="이름을 입력하세요"
                 className="w-full px-5 py-4 bg-stone-50 border-2 border-stone-100 rounded-2xl text-lg font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-center"
                 onKeyDown={(e) => {
                   if (e.key === 'Enter') {
                     if (e.nativeEvent.isComposing) return;
                     e.preventDefault(); // Prevent accidental form submit if wrapped
                     handleCreateUser();
                   }
                 }}
               />
               <button 
                 onClick={handleCreateUser}
                 disabled={!newUserName.trim()}
                 className={`absolute right-2 top-2 bottom-2 aspect-square rounded-xl flex items-center justify-center transition-all
                   ${newUserName.trim() 
                     ? 'bg-emerald-600 text-white shadow-md hover:scale-105 active:scale-95' 
                     : 'bg-gray-100 text-gray-300 cursor-not-allowed'}
                 `}
               >
                 <ArrowRight size={20} />
               </button>
             </div>
          </div>

          {/* User List */}
          <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-3 no-scrollbar mt-4">
            {users.map((user) => (
              <div 
                key={user} 
                onClick={() => handleSelectUser(user)}
                className="group flex items-center justify-between p-4 bg-white border border-stone-100 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-100 transition-all cursor-pointer active:scale-95"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-lg">
                    {user.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-bold text-gray-700">{user}</span>
                </div>
                <button 
                  onClick={(e) => handleDeleteUser(user, e)}
                  className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>

          <button onClick={() => setView('SETTINGS')} className="mt-4 text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1">
             <Settings size={12} /> 데이터 연동 설정
          </button>
          
        </div>
      </div>
    );
  }

  if (view === 'SETTINGS') {
    const validUrlCount = csvConfig.urls.filter(u => u.trim() !== '').length;

    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm border border-stone-100 flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between mb-4 flex-none">
             <button onClick={() => setView(currentUser ? 'LIST' : 'START')} className="text-gray-400 hover:text-gray-600 transition p-2 -ml-2 rounded-full hover:bg-stone-50">
               <ChevronLeft size={24} />
             </button>
             <h2 className="text-lg font-bold text-gray-900">설정</h2>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
            
            {/* Sheet Connection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-wide flex items-center gap-2">
                   <Link size={16} /> 웹에 게시 (CSV)
                </h3>
                {isLoadingBible ? (
                  <Loader2 size={16} className="text-emerald-500 animate-spin" />
                ) : isApiConnected ? (
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Cloud size={10} /> 연결됨</span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><CloudOff size={10} /> 미연결</span>
                )}
              </div>
              
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-500 leading-relaxed">
                   구글 스프레드시트에서 <strong>[파일 &gt; 공유 &gt; 웹에 게시]</strong>를 선택하고, 형식을 <strong>CSV (.csv)</strong>로 설정하여 생성된 링크를 입력해주세요.
                </p>
                {dataStats && (
                  <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-emerald-600 font-bold flex flex-col gap-1">
                    <span>* 상태: {dataStats}</span>
                  </div>
                )}
              </div>
              
              {/* Data Preview Section */}
              {parsePreview.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                   <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500 uppercase">
                     <FileSearch size={12} /> Data Preview (First 3)
                   </div>
                   <div className="space-y-2">
                     {parsePreview.map((line, idx) => (
                       <div key={idx} className="text-[10px] text-slate-600 font-mono bg-white p-1.5 rounded border border-slate-100 truncate">
                         {line}
                       </div>
                     ))}
                   </div>
                </div>
              )}
              
              {parsePreview.length === 0 && isApiConnected && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <div>
                    연결은 되었으나 파싱된 데이터가 없습니다. CSV 형식이나 파일 권한을 확인해주세요.
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {settingsForm.urls.map((url, idx) => (
                  <div key={idx}>
                    <label className="block text-[10px] font-bold text-gray-400 mb-1 ml-1 uppercase">File {idx + 1}</label>
                    <input 
                      type="text"
                      value={url}
                      onChange={(e) => handleUrlChange(idx, e.target.value)}
                      placeholder={`https://docs.google.com/.../pub?output=csv`}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 font-mono text-gray-600"
                    />
                  </div>
                ))}
              </div>

              {apiError && (
                 <div className="text-xs text-red-500 bg-red-50 p-2 rounded-lg">
                   {apiError}
                 </div>
              )}

              <div className="pt-2 flex gap-2">
                <button 
                  onClick={saveSettings}
                  disabled={isLoadingBible}
                  className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-black transition flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
                >
                  <Save size={16} /> 저장 및 연결 ({validUrlCount}개)
                </button>
                {validUrlCount > 0 && (
                   <button 
                     onClick={clearSettings}
                     className="px-4 bg-red-50 text-red-500 rounded-xl font-bold text-sm hover:bg-red-100 transition"
                   >
                     초기화
                   </button>
                )}
              </div>
            </div>

            <div className="h-px bg-gray-100 my-6"></div>

            {/* Data Management */}
            {currentUser && (
              <div className="space-y-3 pb-4">
                 <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide">데이터 관리</h3>
                 <button 
                   onClick={resetProgress}
                   className="w-full bg-white border border-red-200 text-red-500 py-3 rounded-xl font-bold text-sm hover:bg-red-50 transition flex items-center justify-center gap-2"
                 >
                   <RefreshCw size={16} /> 읽기 기록 초기화
                 </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ... (Rest of view methods remain exactly the same as previous)

  if (view === 'DATE_SELECT') {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm border border-stone-100">
          <div className="flex items-center justify-between mb-6">
             <button onClick={() => setView('START')} className="text-gray-400 hover:text-gray-600 transition p-2 -ml-2 rounded-full hover:bg-stone-50">
               <ChevronLeft size={24} />
             </button>
             <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded-full">
               <User size={14} className="text-emerald-600" />
               <span className="text-xs font-bold text-emerald-700">{currentUser}</span>
             </div>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">언제 시작할까요?</h2>
          <p className="text-gray-500 mb-8 text-sm">시작일을 기준으로 매일 읽을 본문이 정해집니다.</p>
          
          <div className="space-y-6">
            <div className="relative">
              <label className="block text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2 ml-1">
                시작 날짜
              </label>
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1" onClick={openDatePicker}>
                  <input 
                    ref={dateInputRef}
                    type="date" 
                    value={tempDate}
                    className="w-full pl-5 pr-4 py-4 bg-stone-50 border-2 border-stone-100 rounded-2xl text-lg font-medium text-gray-900 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all cursor-pointer"
                    onChange={(e) => setTempDate(e.target.value)}
                    onClick={(e) => { e.stopPropagation(); openDatePicker(); }}
                  />
                </div>
                <button 
                  onClick={openDatePicker}
                  className="flex-none w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center hover:bg-emerald-200 transition-colors shadow-sm active:scale-95"
                >
                  <Calendar size={24} />
                </button>
              </div>
            </div>

            <button 
              onClick={handleDateConfirm}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
            >
              확인 및 시작
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'LIST') {
    const safeDay = Math.min(Math.max(1, currentDay), biblePlan.length > 0 ? biblePlan.length : 1);
    const dayData = biblePlan.length > 0 ? biblePlan[safeDay - 1] : null;
    const progress = calculateTotalProgress();

    return (
      <div className="bg-stone-50 flex flex-col max-w-lg mx-auto shadow-2xl min-h-screen relative">
        <header className="bg-white/90 backdrop-blur-md sticky top-0 z-20 border-b border-gray-100">
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <button onClick={handleLogout} className="p-2 -ml-2 text-gray-400 hover:bg-gray-100 rounded-full transition">
                 <ChevronLeft size={20} />
               </button>
               <div>
                  <h1 className="text-xl font-bold text-gray-900">성경 읽기표</h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-center min-w-[30px]">{currentUser}</span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                       {startDate ? `${startDate.split('-')[0]}년 시작` : '날짜 미설정'}
                       {isApiConnected && <Cloud size={10} className="text-blue-400 ml-1" />}
                    </span>
                  </div>
               </div>
            </div>
            <button onClick={() => setView('SETTINGS')} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition">
              <Settings size={20} />
            </button>
          </div>

          <div className="relative">
            <div 
              ref={dateListRef}
              className="flex overflow-x-auto no-scrollbar scroll-smooth px-2 pb-2 items-end h-20 gap-1"
            >
              {biblePlan.length > 0 ? biblePlan.map((plan) => {
                const isSelected = plan.day === currentDay;
                return (
                  <button
                    key={plan.day}
                    data-day={plan.day}
                    onClick={() => setCurrentDay(plan.day)}
                    className={`flex-none w-[4.5rem] flex flex-col items-center justify-center transition-all duration-300 rounded-2xl py-3
                      ${isSelected 
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-100' 
                        : 'bg-transparent text-gray-400 hover:bg-gray-100 scale-90'}
                    `}
                  >
                    <span className={`text-[10px] font-bold uppercase mb-1 ${isSelected ? 'text-emerald-100' : 'text-gray-400'}`}>
                      Day {plan.day}
                    </span>
                    <span className={`text-base font-bold ${isSelected ? 'text-white' : 'text-gray-600'}`}>
                      {getDisplayDateShort(plan.day)}
                    </span>
                  </button>
                );
              }) : (
                <div className="px-4 py-3 text-xs text-gray-400">데이터가 없습니다.</div>
              )}
            </div>
          </div>
        </header>

        <div className="px-4 py-6 bg-stone-50">
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-stone-100 mb-6">
             <div className="flex justify-between items-end mb-3">
                <div>
                   <span className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Total Progress</span>
                   <span className="text-3xl font-extrabold text-gray-900">{progress}%</span>
                </div>
                <div className="text-right">
                   <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                     {currentDay} / {biblePlan.length} 일차
                   </span>
                </div>
             </div>
             <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
               <div 
                 className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-1000 ease-out" 
                 style={{ width: `${progress}%` }}
               ></div>
             </div>
          </div>

          <div className="flex items-center justify-between mb-4 px-1">
             <h2 className="text-lg font-bold text-gray-800">
               {getDisplayDate(currentDay)}
             </h2>
             <span className="text-sm font-medium text-gray-500">
               {dayData?.chapters.length || 0}개 챕터
             </span>
          </div>

          <div className="space-y-3 pb-24">
            {dayData && dayData.chapters.map((chapter, idx) => {
              const isRead = !!completedChapters[chapter.id];
              return (
                <div 
                  key={chapter.id} 
                  onClick={() => openReading(safeDay - 1, idx)}
                  className={`group relative bg-white rounded-2xl p-4 transition-all duration-200 border cursor-pointer overflow-hidden
                    ${isRead 
                      ? 'border-emerald-100 shadow-none opacity-80' 
                      : 'border-white shadow-sm hover:shadow-md hover:-translate-y-0.5'}
                  `}
                >
                  {isRead && <div className="absolute inset-0 bg-emerald-50/50 pointer-events-none"></div>}

                  <div className="relative flex items-center justify-between z-10">
                    <div className="flex items-center gap-4 flex-1">
                       <button 
                         onClick={(e) => toggleChapterCompletion(chapter.id, e)}
                         className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0
                           ${isRead 
                             ? 'bg-emerald-500 text-white rotate-0' 
                             : 'bg-stone-100 text-gray-300 hover:bg-emerald-100 hover:text-emerald-400'}
                         `}
                       >
                         <Check size={20} className={`transition-transform duration-300 ${isRead ? 'scale-100' : 'scale-0'}`} />
                         {!isRead && <div className="w-3 h-3 rounded-full bg-gray-300 group-hover:bg-emerald-300 absolute" />}
                       </button>

                       <div>
                         <span className={`text-xs font-bold uppercase tracking-wide mb-0.5 block
                           ${isRead ? 'text-emerald-600' : 'text-gray-400'}
                         `}>
                           Chapter {idx + 1}
                         </span>
                         <h3 className={`text-lg font-semibold transition-colors
                           ${isRead ? 'text-gray-400 line-through decoration-emerald-300' : 'text-gray-800'}
                         `}>
                           {chapter.title}
                         </h3>
                       </div>
                    </div>
                    
                    <ChevronRight className="text-gray-300 group-hover:text-emerald-500 transition-colors" size={20} />
                  </div>
                </div>
              );
            })}
            {!dayData && (
              <div className="p-8 text-center text-gray-400">
                표시할 내용이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'READING' && activeReading) {
    const dayData = biblePlan[activeReading.dayIndex];
    if (!dayData) return null; // Safety check
    
    const chapter = dayData.chapters[activeReading.chapterIndex];
    const isLastChapterOfDay = activeReading.chapterIndex === dayData.chapters.length - 1;

    return (
      <div className="min-h-screen bg-white flex flex-col max-w-lg mx-auto shadow-2xl">
        <header className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-20">
          <div className="flex items-center justify-between p-4">
             <button 
               onClick={() => setView('LIST')} 
               className="p-2 -ml-2 text-gray-500 hover:bg-stone-50 hover:text-gray-900 rounded-full transition"
             >
               <ChevronLeft size={24} />
             </button>
             <div className="flex flex-col items-center">
               <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Reading</span>
               <span className="text-base font-bold text-gray-900 line-clamp-1">{chapter.title}</span>
             </div>
             <div className="w-10"></div>
          </div>
          <div className="w-full h-1 bg-gray-100">
             <div 
               className="h-full bg-emerald-500 transition-all duration-300"
               style={{ width: `${((activeReading.chapterIndex + 1) / dayData.chapters.length) * 100}%`}}
             ></div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto px-6 py-10">
            <h1 className="text-2xl font-bold text-gray-900 mb-8 font-sans text-center">{chapter.title}</h1>
            <div className="prose prose-lg prose-stone leading-loose text-gray-800 font-serif whitespace-pre-wrap">
              {chapter.content}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-white/95 backdrop-blur safe-area-bottom">
          <button 
            onClick={handleReadingNext}
            className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2
              ${isLastChapterOfDay 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20' 
                : 'bg-gray-900 hover:bg-black text-white shadow-gray-900/20'}
            `}
          >
            {isLastChapterOfDay ? (
              <>오늘의 읽기 완료 <Check size={20} /></>
            ) : (
              <>다음 장으로 <ChevronRight size={20} /></>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'COMPLETION') {
    const progress = calculateTotalProgress();
    
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-10 rounded-[2rem] shadow-xl shadow-emerald-500/10 w-full max-w-sm border border-white/60">
          <div className="w-24 h-24 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-8 ring-8 ring-yellow-50/50">
            <Trophy className="text-yellow-500 drop-shadow-sm" size={48} />
          </div>
          
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Great Job!</h2>
          <p className="text-gray-500 mb-10 leading-relaxed">
            오늘의 말씀을 모두 읽으셨네요.<br/>
            꾸준함이 가장 큰 은혜입니다.
          </p>

          <div className="bg-stone-50 rounded-2xl p-6 mb-8 border border-stone-100">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-gray-500">현재 진도</span>
              <span className="text-sm font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded">{currentDay} / {biblePlan.length} Day</span>
            </div>
            
            <div className="flex items-end justify-between mb-2">
              <span className="text-xs font-semibold text-gray-400">TOTAL</span>
              <span className="text-2xl font-extrabold text-gray-900">{progress}%</span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-1000" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          <button 
            onClick={() => setView('LIST')}
            className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition shadow-lg active:scale-95"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default App;