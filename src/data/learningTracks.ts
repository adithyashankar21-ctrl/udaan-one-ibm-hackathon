/**
 * Learning Hub curriculum. The structure (tracks → courses → modules → subtopics) is
 * curated here; lesson content for each subtopic is explained live by the AI tutor.
 */

export interface LearningModule {
  id: string;
  title: string;
  subtopics: string[];
}

export interface LearningCourse {
  id: string;
  title: string;
  short: string;
  description: string;
  level: 'Beginner' | 'Beginner → Intermediate' | 'Intermediate';
  /** Language used for code blocks; 'python' code can be run in the browser. */
  codeLanguage?: 'python' | 'c' | 'java' | 'javascript' | 'sql' | 'html';
  accent: 'saffron' | 'teal' | 'navy' | 'green' | 'coral';
  glyph: string;
  modules: LearningModule[];
  /** Where to take the matching certified course. */
  certification?: { label: string; url: string };
}

export interface LearningTrack {
  id: string;
  title: string;
  tagline: string;
  courses: LearningCourse[];
}

const m = (id: string, title: string, subtopics: string[]): LearningModule => ({ id, title, subtopics });

const PYTHON: LearningCourse = {
  id: 'python',
  title: 'Python Programming',
  short: 'Python',
  description: 'The friendliest first language — used in data science, AI, automation and web apps. Run every example right here in your browser.',
  level: 'Beginner → Intermediate',
  codeLanguage: 'python',
  accent: 'saffron',
  glyph: 'py',
  certification: { label: 'Skill India Digital Hub', url: 'https://www.skillindiadigital.gov.in/' },
  modules: [
    m('py-basics', 'Getting started', ['What is programming and why Python', 'Your first program: print()', 'Comments and code readability', 'How Python runs your code']),
    m('py-vars', 'Variables & data types', ['Variables and naming rules', 'Numbers: int and float', 'Strings and string methods', 'Booleans and None', 'Type conversion (casting)', 'f-strings and formatting output']),
    m('py-ops', 'Operators', ['Arithmetic operators', 'Comparison operators', 'Logical operators: and, or, not', 'Assignment and augmented operators', 'Operator precedence']),
    m('py-flow', 'Decisions', ['if, elif and else', 'Nested conditions', 'Match-case (pattern matching)', 'Truthy and falsy values']),
    m('py-loops', 'Loops', ['for loops and range()', 'while loops', 'break, continue and pass', 'Nested loops and patterns', 'Looping with enumerate() and zip()']),
    m('py-ds', 'Data structures', ['Lists and list methods', 'Slicing', 'Tuples', 'Sets', 'Dictionaries', 'List and dictionary comprehensions']),
    m('py-func', 'Functions', ['Defining and calling functions', 'Parameters, arguments and return values', 'Default, keyword and *args/**kwargs', 'Scope: local and global', 'Lambda functions', 'Recursion']),
    m('py-err', 'Errors & files', ['Reading error messages (tracebacks)', 'try, except, else and finally', 'Raising your own exceptions', 'Reading and writing text files', 'Working with CSV and JSON']),
    m('py-mod', 'Modules & packages', ['Importing modules', 'Useful standard library: math, random, datetime', 'Creating your own module', 'pip and virtual environments']),
    m('py-oop', 'Object-oriented programming', ['Classes and objects', 'The __init__ method and attributes', 'Methods and self', 'Inheritance', 'Encapsulation and dunder methods']),
    m('py-adv', 'Going further', ['Iterators and generators', 'Decorators', 'Working with dates and times', 'Intro to NumPy and pandas', 'Mini project: student marks report']),
  ],
};

const C_LANG: LearningCourse = {
  id: 'c',
  title: 'C Programming',
  short: 'C',
  description: 'The foundation of computer engineering — understand memory, pointers and how computers really work.',
  level: 'Beginner → Intermediate',
  codeLanguage: 'c',
  accent: 'navy',
  glyph: 'C',
  modules: [
    m('c-basics', 'Basics', ['Structure of a C program', 'Compiling and running', 'Data types and variables', 'printf and scanf']),
    m('c-flow', 'Control flow', ['if-else and switch', 'for, while and do-while loops', 'break and continue']),
    m('c-func', 'Functions & arrays', ['Functions and prototypes', 'Arrays', 'Strings in C', 'Recursion']),
    m('c-ptr', 'Pointers & memory', ['What is a pointer', 'Pointers and arrays', 'Dynamic memory: malloc and free', 'Structures (struct)']),
    m('c-file', 'Files', ['File handling in C', 'Command-line arguments']),
  ],
};

const JAVA: LearningCourse = {
  id: 'java',
  title: 'Java Programming',
  short: 'Java',
  description: 'Widely used for Android apps and enterprise software, with strong object-oriented foundations.',
  level: 'Beginner → Intermediate',
  codeLanguage: 'java',
  accent: 'coral',
  glyph: 'J',
  modules: [
    m('java-basics', 'Basics', ['JDK, JVM and your first program', 'Variables and data types', 'Operators and input with Scanner']),
    m('java-flow', 'Control flow', ['Conditions', 'Loops', 'Arrays']),
    m('java-oop', 'Object-oriented Java', ['Classes and objects', 'Constructors', 'Inheritance and polymorphism', 'Interfaces and abstract classes', 'Encapsulation']),
    m('java-adv', 'Core Java', ['Exception handling', 'Collections: ArrayList and HashMap', 'String handling', 'Intro to threads']),
  ],
};

const WEB: LearningCourse = {
  id: 'web',
  title: 'Web Development (HTML, CSS, JavaScript)',
  short: 'Web',
  description: 'Build websites from scratch — structure with HTML, design with CSS and add interactivity with JavaScript.',
  level: 'Beginner',
  codeLanguage: 'javascript',
  accent: 'teal',
  glyph: '</>',
  modules: [
    m('web-html', 'HTML', ['How the web works', 'HTML elements and structure', 'Links, images and lists', 'Forms and inputs', 'Semantic HTML and accessibility']),
    m('web-css', 'CSS', ['Selectors and the box model', 'Colours, fonts and spacing', 'Flexbox', 'CSS Grid', 'Responsive design for mobile']),
    m('web-js', 'JavaScript', ['Variables, types and operators', 'Functions and arrow functions', 'Arrays and objects', 'The DOM and events', 'Fetching data with fetch()', 'Async and await']),
  ],
};

const SQL: LearningCourse = {
  id: 'sql',
  title: 'Databases & SQL',
  short: 'SQL',
  description: 'Store, query and analyse data — a key skill for every developer and data analyst.',
  level: 'Beginner',
  codeLanguage: 'sql',
  accent: 'green',
  glyph: 'DB',
  modules: [
    m('sql-basics', 'Foundations', ['What is a database', 'Tables, rows and columns', 'Primary and foreign keys']),
    m('sql-query', 'Querying', ['SELECT and WHERE', 'ORDER BY and LIMIT', 'Aggregate functions and GROUP BY', 'JOINs explained']),
    m('sql-modify', 'Changing data', ['INSERT, UPDATE and DELETE', 'CREATE TABLE and data types', 'Normalization basics']),
  ],
};

const DSA: LearningCourse = {
  id: 'dsa',
  title: 'Data Structures & Algorithms',
  short: 'DSA',
  description: 'Think like an engineer — solve problems efficiently and prepare for coding interviews (examples in Python).',
  level: 'Intermediate',
  codeLanguage: 'python',
  accent: 'navy',
  glyph: '{ }',
  modules: [
    m('dsa-intro', 'Foundations', ['What is an algorithm', 'Time and space complexity (Big-O)', 'How to break a problem into steps']),
    m('dsa-linear', 'Linear structures', ['Arrays and two pointers', 'Stacks', 'Queues', 'Linked lists', 'Hashing and hash maps']),
    m('dsa-algo', 'Core algorithms', ['Linear and binary search', 'Bubble, selection and insertion sort', 'Merge sort and quick sort', 'Recursion and backtracking']),
    m('dsa-nonlinear', 'Trees & graphs', ['Binary trees and traversals', 'Binary search trees', 'Graphs: BFS and DFS', 'Intro to dynamic programming']),
  ],
};

const DIGITAL: LearningCourse = {
  id: 'digital-basics',
  title: 'Computer & Digital Basics',
  short: 'Digital',
  description: 'Use a computer and smartphone with confidence — the first step before any course or job.',
  level: 'Beginner',
  accent: 'teal',
  glyph: 'PC',
  modules: [
    m('dig-pc', 'Using a computer', ['Parts of a computer', 'Keyboard and mouse skills', 'Files and folders', 'Typing practice tips']),
    m('dig-net', 'Internet & safety', ['Browsing and searching well', 'Email basics', 'Spotting online fraud and fake calls', 'Strong passwords and OTP safety']),
    m('dig-office', 'Office tools', ['Writing documents', 'Spreadsheets: rows, columns and formulas', 'Making a simple presentation']),
    m('dig-money', 'Digital payments', ['How UPI works', 'Using DigiLocker for documents', 'Safe online banking habits']),
  ],
};

const CAREER: LearningCourse = {
  id: 'career',
  title: 'Job Readiness & Communication',
  short: 'Career',
  description: 'Prepare for interviews, write a resume and communicate confidently at work.',
  level: 'Beginner',
  accent: 'green',
  glyph: 'CV',
  modules: [
    m('car-eng', 'Spoken English', ['Introducing yourself', 'Everyday workplace phrases', 'Talking on the phone politely']),
    m('car-resume', 'Resume & interview', ['Writing your first resume', 'Common interview questions', 'Preparing for a technical interview']),
    m('car-work', 'At work', ['Teamwork and time management', 'Writing a professional email', 'Freelancing and finding remote work']),
  ],
};

export const LEARNING_TRACKS: LearningTrack[] = [
  {
    id: 'computer-engineering',
    title: 'Computer Engineering',
    tagline: 'Programming languages, web development, databases and problem solving.',
    courses: [PYTHON, C_LANG, JAVA, WEB, SQL, DSA],
  },
  {
    id: 'foundations',
    title: 'Foundations for every job',
    tagline: 'Digital skills and job readiness that every training path needs.',
    courses: [DIGITAL, CAREER],
  },
];

export const ALL_COURSES = LEARNING_TRACKS.flatMap((t) => t.courses);
export const COURSE_MAP: Record<string, LearningCourse> = Object.fromEntries(ALL_COURSES.map((c) => [c.id, c]));

export const subtopicKey = (courseId: string, moduleId: string, subtopic: string) => `${courseId}::${moduleId}::${subtopic}`;
export const subtopicCount = (c: LearningCourse) => c.modules.reduce((n, mod) => n + mod.subtopics.length, 0);
