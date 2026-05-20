const fs = require('fs');
const path = require('path');

// ── Scenarios (20 diverse industry contexts) ──
const scenarios = [
  "You are a backend engineer at a fintech startup processing 10K transactions per second",
  "Your team at a healthcare company needs to process millions of patient records securely",
  "A social media platform with 50M daily active users is experiencing performance degradation",
  "An e-commerce giant's checkout system is failing during flash sales with 100K concurrent users",
  "A logistics company needs to optimize delivery routes across 500 cities in real time",
  "Your gaming studio is building a multiplayer server handling 200K concurrent players",
  "An IoT platform ingests sensor data from 2M connected devices every minute",
  "A cybersecurity firm needs to analyze network packets at wire speed for threat detection",
  "An AI/ML startup is building a distributed training pipeline for billion-parameter models",
  "A media streaming service needs to serve adaptive bitrate video to 30M subscribers",
  "An autonomous vehicle company processes LIDAR point clouds at 60fps for obstacle avoidance",
  "An aerospace defense contractor is building mission-critical flight control software",
  "An agri-tech platform monitors soil and weather data across 10K farms for precision agriculture",
  "An education platform serves personalized quizzes to 5M students with adaptive difficulty",
  "A real-estate marketplace needs to power instant property search across 20M listings",
  "A ride-sharing app must match drivers and riders in under 200ms across a metro area",
  "A crypto exchange processes order books with microsecond-level latency requirements",
  "A telehealth platform handles concurrent video consultations with HIPAA-compliant recording",
  "A supply chain analytics company tracks shipments across 50 countries with customs integration",
  "A digital banking platform must reconcile ledger entries across distributed microservices"
];

// ── Skill definitions ──
const skills = [
  { name: "Python Programming", category: "Software Engineering" },
  { name: "C Systems Programming", category: "Systems Engineering" },
  { name: "SQL Database Design", category: "Data Systems" },
  { name: "JavaScript", category: "Web Development" },
  { name: "TypeScript", category: "Web Development" },
  { name: "Go", category: "Software Engineering" },
  { name: "Rust", category: "Systems Engineering" },
  { name: "C++", category: "Systems Engineering" },
  { name: "Docker", category: "DevOps" },
  { name: "Kubernetes", category: "DevOps" },
  { name: "AWS", category: "Cloud Computing" },
  { name: "React", category: "Web Development" },
  { name: "Node.js", category: "Web Development" },
  { name: "HTML5 & CSS3", category: "Web Development" }
];

// ── Problem templates per skill (title + code skeleton) ──
function getProblems(skillName) {
  const p = { easy: [], medium: [], hard: [] };

  switch (skillName) {
    case "Python Programming":
      p.easy = [
        { t: "Implement a function to check if a string is a palindrome", c: "def is_palindrome(s: str) -> bool:\\n    # Your code here\\n    pass" },
        { t: "Write a function to find the maximum element in a list without using max()", c: "def find_max(lst: list) -> int:\\n    # Your code here\\n    pass" },
        { t: "Implement a basic stack using a Python list", c: "class Stack:\\n    def __init__(self):\\n        self.items = []\\n    def push(self, item):\\n        pass\\n    def pop(self):\\n        pass" },
        { t: "Create a function to count word frequencies in a text string", c: "def word_freq(text: str) -> dict:\\n    # Your code here\\n    pass" },
        { t: "Write a function to flatten a nested list recursively", c: "def flatten(nested: list) -> list:\\n    # Your code here\\n    pass" },
        { t: "Implement binary search on a sorted list", c: "def binary_search(arr: list, target: int) -> int:\\n    # Return index or -1\\n    pass" },
        { t: "Create a function that returns the Fibonacci sequence up to n terms", c: "def fibonacci(n: int) -> list:\\n    # Your code here\\n    pass" },
        { t: "Write a function to remove duplicate elements preserving order", c: "def remove_duplicates(lst: list) -> list:\\n    # Your code here\\n    pass" },
        { t: "Implement a Caesar cipher encoder and decoder", c: "def caesar_encode(text: str, shift: int) -> str:\\n    pass\\ndef caesar_decode(text: str, shift: int) -> str:\\n    pass" },
        { t: "Create a function to validate email format using regex", c: "import re\\ndef is_valid_email(email: str) -> bool:\\n    # Your code here\\n    pass" },
        { t: "Write a function to merge two sorted lists into one sorted list", c: "def merge_sorted(a: list, b: list) -> list:\\n    # Your code here\\n    pass" },
        { t: "Implement a basic queue using collections.deque", c: "from collections import deque\\nclass Queue:\\n    def __init__(self):\\n        self.q = deque()\\n    def enqueue(self, item): pass\\n    def dequeue(self): pass" },
        { t: "Create a function to compute the GCD of two numbers", c: "def gcd(a: int, b: int) -> int:\\n    # Your code here\\n    pass" },
        { t: "Write a function to rotate a list by k positions", c: "def rotate_list(lst: list, k: int) -> list:\\n    # Your code here\\n    pass" },
        { t: "Implement a function to check if two strings are anagrams", c: "def are_anagrams(s1: str, s2: str) -> bool:\\n    # Your code here\\n    pass" },
        { t: "Create a simple key-value cache with a size limit", c: "class SimpleCache:\\n    def __init__(self, capacity: int):\\n        self.capacity = capacity\\n        self.store = {}\\n    def get(self, key): pass\\n    def put(self, key, val): pass" },
        { t: "Write a function to compute the power set of a list", c: "def power_set(s: list) -> list:\\n    # Your code here\\n    pass" },
        { t: "Implement matrix addition for two 2D lists", c: "def matrix_add(a: list, b: list) -> list:\\n    # Your code here\\n    pass" },
        { t: "Create a function to convert a Roman numeral string to integer", c: "def roman_to_int(s: str) -> int:\\n    # Your code here\\n    pass" },
        { t: "Write a function to find the intersection of two lists", c: "def intersection(a: list, b: list) -> list:\\n    # Your code here\\n    pass" },
      ];
      p.medium = [
        { t: "Implement an LRU Cache with O(1) get and put operations", c: "from collections import OrderedDict\\nclass LRUCache:\\n    def __init__(self, capacity: int):\\n        self.capacity = capacity\\n        self.cache = OrderedDict()\\n    def get(self, key: int) -> int: pass\\n    def put(self, key: int, value: int): pass" },
        { t: "Build a trie data structure for autocomplete suggestions", c: "class TrieNode:\\n    def __init__(self):\\n        self.children = {}\\n        self.is_end = False\\nclass Trie:\\n    def __init__(self):\\n        self.root = TrieNode()\\n    def insert(self, word: str): pass\\n    def search(self, prefix: str) -> list: pass" },
        { t: "Implement Dijkstra's shortest path algorithm", c: "import heapq\\ndef dijkstra(graph: dict, start: str) -> dict:\\n    # Return shortest distances\\n    pass" },
        { t: "Design a rate limiter using the token bucket algorithm", c: "import time\\nclass TokenBucket:\\n    def __init__(self, rate: int, capacity: int):\\n        self.rate = rate\\n        self.capacity = capacity\\n    def allow_request(self) -> bool: pass" },
        { t: "Create a thread pool executor from scratch", c: "import threading\\nfrom queue import Queue\\nclass ThreadPool:\\n    def __init__(self, num_threads: int): pass\\n    def submit(self, fn, *args): pass\\n    def shutdown(self): pass" },
        { t: "Implement a binary search tree with insert, delete and search", c: "class BSTNode:\\n    def __init__(self, val):\\n        self.val = val\\n        self.left = None\\n        self.right = None\\nclass BST:\\n    def insert(self, val): pass\\n    def delete(self, val): pass\\n    def search(self, val) -> bool: pass" },
        { t: "Build a simple pub-sub event system", c: "class EventBus:\\n    def __init__(self):\\n        self.subscribers = {}\\n    def subscribe(self, event, callback): pass\\n    def publish(self, event, data): pass" },
        { t: "Implement topological sort for a DAG", c: "def topological_sort(graph: dict) -> list:\\n    # Return sorted vertices\\n    pass" },
        { t: "Create a connection pool manager", c: "import threading\\nclass ConnectionPool:\\n    def __init__(self, max_size: int): pass\\n    def acquire(self): pass\\n    def release(self, conn): pass" },
        { t: "Implement the KMP string matching algorithm", c: "def kmp_search(text: str, pattern: str) -> list:\\n    # Return all match indices\\n    pass" },
        { t: "Build a priority queue using a min-heap", c: "class MinHeap:\\n    def __init__(self):\\n        self.heap = []\\n    def push(self, val): pass\\n    def pop(self): pass\\n    def peek(self): pass" },
        { t: "Implement a graph BFS and DFS traversal engine", c: "def bfs(graph: dict, start) -> list: pass\\ndef dfs(graph: dict, start) -> list: pass" },
        { t: "Create an async task scheduler with dependency resolution", c: "import asyncio\\nclass TaskScheduler:\\n    def __init__(self): self.tasks = {}\\n    def add_task(self, name, deps, fn): pass\\n    async def run_all(self): pass" },
        { t: "Build a bloom filter for membership testing", c: "import hashlib\\nclass BloomFilter:\\n    def __init__(self, size: int, num_hashes: int): pass\\n    def add(self, item: str): pass\\n    def contains(self, item: str) -> bool: pass" },
        { t: "Implement a skip list data structure", c: "import random\\nclass SkipList:\\n    def __init__(self): pass\\n    def insert(self, val): pass\\n    def search(self, val) -> bool: pass" },
        { t: "Create a JSON parser that handles nested objects and arrays", c: "def parse_json(s: str):\\n    # Return parsed Python object\\n    pass" },
        { t: "Implement a consistent hashing ring", c: "import hashlib\\nclass ConsistentHash:\\n    def __init__(self, nodes: list, replicas: int): pass\\n    def get_node(self, key: str) -> str: pass\\n    def add_node(self, node: str): pass" },
        { t: "Build a retry decorator with exponential backoff", c: "import time, functools\\ndef retry(max_attempts=3, backoff=2):\\n    def decorator(fn):\\n        @functools.wraps(fn)\\n        def wrapper(*a, **kw): pass\\n        return wrapper\\n    return decorator" },
        { t: "Implement union-find with path compression", c: "class UnionFind:\\n    def __init__(self, n: int): pass\\n    def find(self, x: int) -> int: pass\\n    def union(self, x: int, y: int): pass" },
        { t: "Create a middleware pipeline processor", c: "class Pipeline:\\n    def __init__(self):\\n        self.steps = []\\n    def use(self, middleware): pass\\n    def execute(self, context): pass" },
      ];
      p.hard = [
        { t: "Implement A* pathfinding on a weighted 2D grid", c: "from typing import List, Tuple\\nimport heapq\\ndef a_star(grid: List[List[int]], start: Tuple, end: Tuple) -> List[Tuple]:\\n    # Your code here\\n    pass" },
        { t: "Build a distributed task queue with worker fault tolerance", c: "import threading, queue, time\\nclass DistributedQueue:\\n    def __init__(self, num_workers: int): pass\\n    def submit(self, task): pass\\n    def handle_failure(self, worker_id): pass" },
        { t: "Implement a B-Tree with insert and range query operations", c: "class BTreeNode:\\n    def __init__(self, t, leaf=False): pass\\nclass BTree:\\n    def __init__(self, t): pass\\n    def insert(self, key): pass\\n    def range_query(self, lo, hi) -> list: pass" },
        { t: "Create a garbage collector using mark-and-sweep algorithm", c: "class GC:\\n    def __init__(self): self.objects = []\\n    def allocate(self, obj): pass\\n    def mark(self, root): pass\\n    def sweep(self): pass" },
        { t: "Implement a RAFT consensus protocol simulator", c: "import random, time\\nclass RaftNode:\\n    def __init__(self, node_id, peers): pass\\n    def request_vote(self): pass\\n    def append_entries(self, entries): pass" },
        { t: "Build a compile-time expression evaluator with AST parsing", c: "class ASTNode: pass\\nclass Parser:\\n    def __init__(self, tokens): pass\\n    def parse(self) -> ASTNode: pass\\ndef evaluate(node: ASTNode): pass" },
        { t: "Implement a red-black tree with self-balancing insert", c: "class RBNode:\\n    def __init__(self, val, color='red'): pass\\nclass RedBlackTree:\\n    def insert(self, val): pass\\n    def _fix_insert(self, node): pass" },
        { t: "Create a lock-free concurrent hash map", c: "import threading\\nclass ConcurrentHashMap:\\n    def __init__(self, buckets=16): pass\\n    def get(self, key): pass\\n    def put(self, key, val): pass" },
        { t: "Implement a neural network forward and backward pass from scratch", c: "import numpy as np\\nclass NeuralNet:\\n    def __init__(self, layers: list): pass\\n    def forward(self, x): pass\\n    def backward(self, loss_grad): pass" },
        { t: "Build a log-structured merge tree (LSM-Tree) storage engine", c: "class LSMTree:\\n    def __init__(self, memtable_size: int): pass\\n    def put(self, key, value): pass\\n    def get(self, key): pass\\n    def compact(self): pass" },
        { t: "Implement a virtual memory page replacement simulator (LRU/Clock)", c: "class PageTable:\\n    def __init__(self, num_frames: int): pass\\n    def access(self, page_id: int) -> bool: pass\\n    def evict(self) -> int: pass" },
        { t: "Create a distributed consistent snapshot algorithm (Chandy-Lamport)", c: "class Process:\\n    def __init__(self, pid): pass\\n    def initiate_snapshot(self): pass\\n    def receive_marker(self, sender): pass" },
        { t: "Implement a CRDTs-based eventually consistent counter", c: "class GCounter:\\n    def __init__(self, node_id, num_nodes): pass\\n    def increment(self): pass\\n    def merge(self, other): pass\\n    def value(self) -> int: pass" },
        { t: "Build a query optimizer that chooses between index scan and full scan", c: "class QueryOptimizer:\\n    def __init__(self, table_stats: dict): pass\\n    def estimate_cost(self, query) -> float: pass\\n    def choose_plan(self, query) -> str: pass" },
        { t: "Implement a write-ahead log (WAL) for crash recovery", c: "class WAL:\\n    def __init__(self, log_path: str): pass\\n    def append(self, entry): pass\\n    def recover(self) -> list: pass\\n    def checkpoint(self): pass" },
        { t: "Create a MapReduce framework simulator", c: "class MapReduce:\\n    def __init__(self, num_reducers: int): pass\\n    def map(self, fn, data): pass\\n    def reduce(self, fn): pass\\n    def execute(self) -> dict: pass" },
        { t: "Implement a compiler lexer and tokenizer for a mini language", c: "from enum import Enum\\nclass TokenType(Enum): pass\\nclass Token:\\n    def __init__(self, type, value): pass\\nclass Lexer:\\n    def __init__(self, source: str): pass\\n    def tokenize(self) -> list: pass" },
        { t: "Build an actor model concurrency framework", c: "import threading, queue\\nclass Actor:\\n    def __init__(self): pass\\n    def send(self, message): pass\\n    def receive(self, message): pass\\nclass ActorSystem:\\n    def create_actor(self, cls) -> Actor: pass" },
        { t: "Implement a vector clock for distributed event ordering", c: "class VectorClock:\\n    def __init__(self, node_id, num_nodes): pass\\n    def tick(self): pass\\n    def merge(self, other): pass\\n    def happens_before(self, other) -> bool: pass" },
        { t: "Create a copy-on-write persistent data structure", c: "class PersistentList:\\n    def __init__(self, data=None): pass\\n    def append(self, val) -> 'PersistentList': pass\\n    def set(self, idx, val) -> 'PersistentList': pass\\n    def get_version(self, v: int) -> list: pass" },
      ];
      break;

    case "C Systems Programming":
      p.easy = [
        { t: "Implement a dynamic array (vector) with automatic resizing", c: "#include <stdlib.h>\\ntypedef struct { int *data; int size; int cap; } Vec;\\nvoid vec_push(Vec *v, int val) { /* your code */ }\\nint vec_get(Vec *v, int i) { return v->data[i]; }" },
        { t: "Write a string copy function without using strcpy", c: "#include <stdio.h>\\nvoid my_strcpy(char *dest, const char *src) {\\n    /* your code */\\n}" },
        { t: "Implement a singly linked list with insert and delete", c: "typedef struct Node { int data; struct Node *next; } Node;\\nNode* insert(Node *head, int val) { /* your code */ return head; }\\nNode* delete(Node *head, int val) { /* your code */ return head; }" },
        { t: "Create a function to reverse an integer array in place", c: "void reverse(int arr[], int n) {\\n    /* your code */\\n}" },
        { t: "Write a bubble sort implementation", c: "void bubble_sort(int arr[], int n) {\\n    /* your code */\\n}" },
        { t: "Implement atoi (string to integer) without stdlib", c: "int my_atoi(const char *str) {\\n    /* your code */\\n    return 0;\\n}" },
        { t: "Create a circular buffer for fixed-size data logging", c: "typedef struct { int *buf; int head; int tail; int cap; } CircBuf;\\nvoid cb_write(CircBuf *cb, int val) { /* your code */ }\\nint cb_read(CircBuf *cb) { /* your code */ return 0; }" },
        { t: "Write a function to count set bits in an integer", c: "int count_bits(unsigned int n) {\\n    /* your code */\\n    return 0;\\n}" },
        { t: "Implement a basic hash table with chaining", c: "typedef struct Entry { char *key; int val; struct Entry *next; } Entry;\\ntypedef struct { Entry **buckets; int size; } HashTable;\\nvoid ht_put(HashTable *ht, const char *key, int val) { /* your code */ }" },
        { t: "Create a stack data structure using arrays", c: "typedef struct { int *data; int top; int cap; } Stack;\\nvoid stack_push(Stack *s, int val) { /* your code */ }\\nint stack_pop(Stack *s) { /* your code */ return 0; }" },
        { t: "Write a safe string concatenation function with buffer bounds", c: "void safe_strcat(char *dest, const char *src, int max_len) {\\n    /* your code */\\n}" },
        { t: "Implement a queue using two stacks", c: "typedef struct { int s1[100]; int s2[100]; int t1; int t2; } QueueTwoStacks;\\nvoid enqueue(QueueTwoStacks *q, int val) { /* your code */ }\\nint dequeue(QueueTwoStacks *q) { /* your code */ return 0; }" },
        { t: "Create a function to find duplicates in an integer array", c: "void find_duplicates(int arr[], int n) {\\n    /* print duplicates */\\n}" },
        { t: "Write a matrix multiplication function for 2D arrays", c: "void mat_mul(int a[][10], int b[][10], int c[][10], int n) {\\n    /* your code */\\n}" },
        { t: "Implement a basic file reader that counts lines and words", c: "#include <stdio.h>\\nvoid count_file(const char *path, int *lines, int *words) {\\n    /* your code */\\n}" },
        { t: "Create a function to check if a string is a valid integer", c: "int is_valid_int(const char *s) {\\n    /* return 1 if valid, 0 otherwise */\\n    return 0;\\n}" },
        { t: "Write an insertion sort for an integer array", c: "void insertion_sort(int arr[], int n) {\\n    /* your code */\\n}" },
        { t: "Implement a simple command-line argument parser", c: "#include <stdio.h>\\nvoid parse_args(int argc, char *argv[]) {\\n    /* your code */\\n}" },
        { t: "Create a doubly linked list with forward and backward traversal", c: "typedef struct DNode { int data; struct DNode *prev; struct DNode *next; } DNode;\\nDNode* dll_insert(DNode *head, int val) { /* your code */ return head; }" },
        { t: "Write a function to convert decimal to binary string", c: "void to_binary(int n, char *out) {\\n    /* your code */\\n}" },
      ];
      p.medium = [
        { t: "Implement a thread-safe producer-consumer queue with pthreads", c: "#include <pthread.h>\\ntypedef struct { int *buf; int size; int cap; pthread_mutex_t lock; pthread_cond_t not_empty; pthread_cond_t not_full; } PCQueue;\\nvoid pcq_produce(PCQueue *q, int val) { /* your code */ }\\nint pcq_consume(PCQueue *q) { /* your code */ return 0; }" },
        { t: "Build a memory pool allocator for fixed-size blocks", c: "#include <stddef.h>\\ntypedef struct { void *pool; int block_size; int num_blocks; } MemPool;\\nvoid* pool_alloc(MemPool *mp) { /* your code */ return NULL; }\\nvoid pool_free(MemPool *mp, void *ptr) { /* your code */ }" },
        { t: "Implement a red-black tree insert with balancing", c: "typedef struct RBNode { int key; int color; struct RBNode *left, *right, *parent; } RBNode;\\nRBNode* rb_insert(RBNode *root, int key) { /* your code */ return root; }" },
        { t: "Create a simple TCP echo server using sockets", c: "#include <sys/socket.h>\\n#include <netinet/in.h>\\nvoid run_server(int port) {\\n    /* your code */\\n}" },
        { t: "Write a multi-threaded merge sort", c: "#include <pthread.h>\\nvoid* threaded_merge_sort(void *arg) {\\n    /* your code */\\n    return NULL;\\n}" },
        { t: "Implement a signal handler for graceful process shutdown", c: "#include <signal.h>\\nvolatile sig_atomic_t running = 1;\\nvoid handle_signal(int sig) { /* your code */ }\\nvoid setup_handlers() { /* your code */ }" },
        { t: "Build a simple garbage collector using reference counting", c: "typedef struct GCObj { void *data; int ref_count; } GCObj;\\nGCObj* gc_alloc(size_t size) { /* your code */ return NULL; }\\nvoid gc_retain(GCObj *obj) { /* your code */ }\\nvoid gc_release(GCObj *obj) { /* your code */ }" },
        { t: "Create a pipe-based IPC message passing system", c: "#include <unistd.h>\\nvoid ipc_send(int fd, const char *msg) { /* your code */ }\\nchar* ipc_recv(int fd) { /* your code */ return NULL; }" },
        { t: "Implement a coroutine system using setjmp/longjmp", c: "#include <setjmp.h>\\ntypedef struct { jmp_buf ctx; int state; } Coroutine;\\nvoid co_yield(Coroutine *co) { /* your code */ }\\nvoid co_resume(Coroutine *co) { /* your code */ }" },
        { t: "Write a custom printf implementation supporting %%d, %%s, %%x", c: "#include <stdarg.h>\\nvoid my_printf(const char *fmt, ...) {\\n    /* your code */\\n}" },
        { t: "Build an epoll-based event loop for I/O multiplexing", c: "#include <sys/epoll.h>\\ntypedef struct { int epfd; int max_events; } EventLoop;\\nvoid loop_run(EventLoop *el) { /* your code */ }" },
        { t: "Implement a trie for fast prefix-based string lookup", c: "typedef struct TrieNode { struct TrieNode *children[26]; int is_end; } TrieNode;\\nvoid trie_insert(TrieNode *root, const char *word) { /* your code */ }\\nint trie_search(TrieNode *root, const char *prefix) { /* your code */ return 0; }" },
        { t: "Create a memory-mapped file reader for large log analysis", c: "#include <sys/mman.h>\\nchar* mmap_read(const char *path, size_t *len) { /* your code */ return NULL; }" },
        { t: "Write a lock-free stack using compare-and-swap", c: "#include <stdatomic.h>\\ntypedef struct LFNode { int val; struct LFNode *next; } LFNode;\\ntypedef struct { _Atomic(LFNode*) head; } LFStack;\\nvoid lfs_push(LFStack *s, int val) { /* your code */ }" },
        { t: "Implement a timer wheel for efficient timeout management", c: "typedef struct { void (*callback)(); int ticks; } Timer;\\ntypedef struct { Timer **slots; int num_slots; int current; } TimerWheel;\\nvoid tw_add(TimerWheel *tw, Timer *t) { /* your code */ }\\nvoid tw_tick(TimerWheel *tw) { /* your code */ }" },
        { t: "Build a B-tree for disk-based indexing", c: "typedef struct BTreeNode { int *keys; struct BTreeNode **children; int n; int leaf; } BTreeNode;\\nvoid btree_insert(BTreeNode **root, int key) { /* your code */ }" },
        { t: "Create a POSIX shared memory segment manager", c: "#include <sys/shm.h>\\nvoid* shm_create(size_t size) { /* your code */ return NULL; }\\nvoid shm_destroy(void *ptr) { /* your code */ }" },
        { t: "Implement a read-write lock from scratch using mutexes", c: "#include <pthread.h>\\ntypedef struct { pthread_mutex_t lock; pthread_cond_t cond; int readers; int writers; } RWLock;\\nvoid rw_read_lock(RWLock *rw) { /* your code */ }\\nvoid rw_write_lock(RWLock *rw) { /* your code */ }" },
        { t: "Write an AVL tree with self-balancing rotations", c: "typedef struct AVLNode { int key; int height; struct AVLNode *left, *right; } AVLNode;\\nAVLNode* avl_insert(AVLNode *root, int key) { /* your code */ return root; }" },
        { t: "Create a basic regex engine supporting . and *", c: "int regex_match(const char *text, const char *pattern) {\\n    /* your code */\\n    return 0;\\n}" },
      ];
      p.hard = [
        { t: "Implement a custom slab memory allocator for kernel-style allocation", c: "#include <stddef.h>\\ntypedef struct { void *slabs; int obj_size; int slab_size; } SlabCache;\\nvoid* slab_alloc(SlabCache *cache) { /* your code */ return NULL; }\\nvoid slab_free(SlabCache *cache, void *ptr) { /* your code */ }" },
        { t: "Build a user-space threading library with cooperative scheduling", c: "#include <ucontext.h>\\ntypedef struct { ucontext_t ctx; int state; } UThread;\\nvoid uth_create(UThread *t, void (*fn)(void)) { /* your code */ }\\nvoid uth_yield() { /* your code */ }\\nvoid uth_scheduler() { /* your code */ }" },
        { t: "Implement a virtual memory manager with page table and TLB", c: "typedef struct { int vpn; int ppn; int valid; } PageEntry;\\ntypedef struct { PageEntry *table; int size; int *tlb; } VMM;\\nint vmm_translate(VMM *vmm, int virtual_addr) { /* your code */ return -1; }" },
        { t: "Create a write-ahead log for a transactional key-value store", c: "#include <stdio.h>\\ntypedef struct { FILE *log_file; int seq_num; } WAL;\\nvoid wal_append(WAL *w, const char *op, const char *key, const char *val) { /* your code */ }\\nvoid wal_recover(WAL *w) { /* your code */ }" },
        { t: "Build a network packet sniffer using raw sockets", c: "#include <sys/socket.h>\\nvoid sniff_packets(const char *iface) {\\n    /* capture and parse ethernet/IP/TCP headers */\\n}" },
        { t: "Implement a simple filesystem in user space (FUSE-like)", c: "typedef struct { char name[256]; char *data; int size; int is_dir; } FSEntry;\\nint fs_create(const char *path) { /* your code */ return 0; }\\nint fs_read(const char *path, char *buf, int size) { /* your code */ return 0; }\\nint fs_write(const char *path, const char *buf, int size) { /* your code */ return 0; }" },
        { t: "Create a lock-free concurrent hash map with hazard pointers", c: "#include <stdatomic.h>\\ntypedef struct HNode { char *key; int val; _Atomic(struct HNode*) next; } HNode;\\ntypedef struct { _Atomic(HNode*) *buckets; int num_buckets; } ConcurrentMap;\\nvoid cm_put(ConcurrentMap *cm, const char *key, int val) { /* your code */ }" },
        { t: "Implement a JIT compiler for a simple bytecode instruction set", c: "#include <sys/mman.h>\\ntypedef struct { unsigned char *code; int size; } JITBlock;\\nJITBlock* jit_compile(int *bytecode, int len) { /* your code */ return NULL; }\\nint jit_execute(JITBlock *block) { /* your code */ return 0; }" },
        { t: "Build a Raft consensus log replication module", c: "typedef struct { int term; int leader_id; int *log; int log_len; int commit_idx; } RaftState;\\nvoid raft_append(RaftState *s, int entry) { /* your code */ }\\nvoid raft_replicate(RaftState *leader, RaftState *follower) { /* your code */ }" },
        { t: "Create an io_uring based async I/O engine", c: "/* Implement async I/O using io_uring */\\ntypedef struct { int ring_fd; void *sq; void *cq; } AsyncEngine;\\nvoid ae_submit_read(AsyncEngine *ae, int fd, void *buf, int size) { /* your code */ }\\nvoid ae_poll(AsyncEngine *ae) { /* your code */ }" },
        { t: "Implement a copy-on-write fork mechanism simulator", c: "typedef struct { int *pages; int *ref_counts; int num_pages; } Process;\\nProcess* cow_fork(Process *parent) { /* your code */ return NULL; }\\nvoid cow_write(Process *p, int page_idx, int val) { /* your code */ }" },
        { t: "Build a kernel-style buddy allocator", c: "typedef struct { void *mem; int total_size; int min_block; } BuddyAlloc;\\nvoid* buddy_alloc(BuddyAlloc *ba, size_t size) { /* your code */ return NULL; }\\nvoid buddy_free(BuddyAlloc *ba, void *ptr) { /* your code */ }" },
        { t: "Implement an ELF binary loader and symbol resolver", c: "typedef struct { char *name; unsigned long addr; } Symbol;\\nSymbol* load_elf(const char *path, int *num_symbols) { /* your code */ return NULL; }" },
        { t: "Create a DWARF debug info parser for stack unwinding", c: "typedef struct { unsigned long pc; const char *func_name; const char *file; int line; } FrameInfo;\\nFrameInfo* unwind_stack(int *num_frames) { /* your code */ return NULL; }" },
        { t: "Build a ptrace-based system call tracer", c: "#include <sys/ptrace.h>\\nvoid trace_process(pid_t pid) {\\n    /* Intercept and log syscalls */\\n}" },
        { t: "Implement a TCP/IP stack from scratch on raw sockets", c: "typedef struct { unsigned char *data; int len; } Packet;\\nvoid tcp_handshake(int raw_fd, unsigned int dest_ip, int dest_port) { /* your code */ }\\nvoid tcp_send(int raw_fd, const char *data, int len) { /* your code */ }" },
        { t: "Create a memory-safe arena allocator with region-based lifetimes", c: "typedef struct { char *base; int offset; int capacity; } Arena;\\nvoid* arena_alloc(Arena *a, size_t size) { /* your code */ return NULL; }\\nvoid arena_reset(Arena *a) { /* your code */ }\\nvoid arena_destroy(Arena *a) { /* your code */ }" },
        { t: "Build a deterministic replay debugger using syscall interception", c: "typedef struct { int syscall_nr; long args[6]; long ret; } SyscallRecord;\\nvoid record_execution(pid_t pid) { /* your code */ }\\nvoid replay_execution(SyscallRecord *log, int len) { /* your code */ }" },
        { t: "Implement a wait-free MPMC queue for real-time systems", c: "#include <stdatomic.h>\\ntypedef struct { _Atomic(int) *buffer; int capacity; _Atomic(int) head; _Atomic(int) tail; } MPMCQueue;\\nint mpmc_push(MPMCQueue *q, int val) { /* your code */ return 0; }\\nint mpmc_pop(MPMCQueue *q, int *val) { /* your code */ return 0; }" },
        { t: "Create a seccomp sandbox for system call filtering", c: "#include <linux/seccomp.h>\\nvoid setup_sandbox(int *allowed_syscalls, int count) {\\n    /* Install BPF filter */\\n}" },
      ];
      break;

    // For remaining skills, use a compact generator
    default:
      p.easy = generateGenericProblems(skillName, 'easy');
      p.medium = generateGenericProblems(skillName, 'medium');
      p.hard = generateGenericProblems(skillName, 'hard');
      break;
  }
  return p;
}

function generateGenericProblems(skill, diff) {
  const templates = getSkillTemplates(skill);
  if (!templates) return [];
  return templates[diff] || [];
}

function getSkillTemplates(skill) {
  const t = {};

  if (skill === "SQL Database Design") {
    t.easy = [
      { t: "Write a query to find employees earning more than their manager", c: "-- Table: employees (id INT, name VARCHAR, salary INT, manager_id INT)\\nSELECT e.name FROM employees e\\nJOIN employees m ON e.manager_id = m.id\\nWHERE e.salary > m.salary;" },
      { t: "Create a query to find duplicate email addresses", c: "-- Table: users (id INT, email VARCHAR)\\nSELECT email, COUNT(*) as cnt FROM users\\nGROUP BY email HAVING cnt > 1;" },
      { t: "Write a query to get the second highest salary", c: "-- Table: employees (id INT, salary INT)\\nSELECT MAX(salary) FROM employees\\nWHERE salary < (SELECT MAX(salary) FROM employees);" },
      { t: "Create a query to join orders with customer details", c: "-- Tables: orders (id, customer_id, total), customers (id, name)\\nSELECT c.name, o.total FROM orders o\\nJOIN customers c ON o.customer_id = c.id;" },
      { t: "Write a query to count records per category", c: "-- Table: products (id INT, name VARCHAR, category VARCHAR)\\nSELECT category, COUNT(*) as total\\nFROM products GROUP BY category;" },
      { t: "Create an INSERT trigger to log changes", c: "-- Write a trigger that logs inserts to an audit table\\nCREATE TRIGGER log_insert AFTER INSERT ON orders\\nBEGIN\\n  INSERT INTO audit_log (action, table_name, timestamp)\\n  VALUES ('INSERT', 'orders', CURRENT_TIMESTAMP);\\nEND;" },
      { t: "Write a query to find NULL values in critical columns", c: "-- Table: users (id, name, email, phone)\\nSELECT * FROM users\\nWHERE email IS NULL OR phone IS NULL;" },
      { t: "Create a view combining customer and order data", c: "-- Create a view for customer order summary\\nCREATE VIEW customer_summary AS\\nSELECT c.name, COUNT(o.id) as order_count, SUM(o.total) as total_spent\\nFROM customers c LEFT JOIN orders o ON c.id = o.customer_id\\nGROUP BY c.id;" },
      { t: "Write a CASE expression to categorize values", c: "-- Categorize employees by salary range\\nSELECT name, salary,\\n  CASE\\n    WHEN salary < 50000 THEN 'Junior'\\n    WHEN salary < 100000 THEN 'Mid'\\n    ELSE 'Senior'\\n  END as level\\nFROM employees;" },
      { t: "Create an index strategy for a search-heavy table", c: "-- Optimize a products table for search queries\\nCREATE INDEX idx_products_name ON products(name);\\nCREATE INDEX idx_products_category ON products(category);\\nCREATE INDEX idx_products_price ON products(price);" },
      { t: "Write a query using UNION to combine results from two tables", c: "-- Combine active and archived orders\\nSELECT id, customer_id, total FROM active_orders\\nUNION ALL\\nSELECT id, customer_id, total FROM archived_orders;" },
      { t: "Create a query to pivot rows into columns", c: "-- Pivot monthly sales into columns\\nSELECT product_id,\\n  SUM(CASE WHEN month=1 THEN amount ELSE 0 END) as jan,\\n  SUM(CASE WHEN month=2 THEN amount ELSE 0 END) as feb\\nFROM sales GROUP BY product_id;" },
      { t: "Write a self-join to find pairs of related records", c: "-- Find pairs of students in same class\\nSELECT a.name, b.name FROM students a\\nJOIN students b ON a.class_id = b.class_id\\nWHERE a.id < b.id;" },
      { t: "Create a DELETE query with a subquery filter", c: "-- Delete inactive users who have no orders\\nDELETE FROM users\\nWHERE id NOT IN (SELECT DISTINCT customer_id FROM orders)\\nAND last_login < DATE_SUB(NOW(), INTERVAL 1 YEAR);" },
      { t: "Write a query to calculate percentage of total", c: "-- Calculate each product's percentage of total sales\\nSELECT product_id, amount,\\n  ROUND(amount * 100.0 / (SELECT SUM(amount) FROM sales), 2) as pct\\nFROM sales;" },
      { t: "Create a multi-table UPDATE using a join", c: "-- Update product prices based on category discount\\nUPDATE products p\\nJOIN categories c ON p.category_id = c.id\\nSET p.price = p.price * (1 - c.discount_pct / 100);" },
      { t: "Write a query using EXISTS for correlated subquery", c: "-- Find customers who have placed at least one order\\nSELECT name FROM customers c\\nWHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);" },
      { t: "Create a query to find gaps in sequential IDs", c: "-- Find missing IDs in a sequence\\nSELECT a.id + 1 as gap_start\\nFROM records a\\nLEFT JOIN records b ON a.id + 1 = b.id\\nWHERE b.id IS NULL;" },
      { t: "Write a date-based aggregation query", c: "-- Aggregate daily sales by week\\nSELECT DATE_TRUNC('week', sale_date) as week,\\n  SUM(amount) as weekly_total\\nFROM sales GROUP BY week ORDER BY week;" },
      { t: "Implement a basic pagination query", c: "-- Paginate results: page 3, 20 items per page\\nSELECT * FROM products\\nORDER BY created_at DESC\\nLIMIT 20 OFFSET 40;" },
    ];
    t.medium = [
      { t: "Compute a 7-day running average using window functions", c: "-- Calculate 7-day running revenue average\\nSELECT date, revenue,\\n  AVG(revenue) OVER(ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as avg_7d\\nFROM daily_revenue;" },
      { t: "Write a recursive CTE to traverse an org hierarchy", c: "-- Traverse employee hierarchy\\nWITH RECURSIVE org_tree AS (\\n  SELECT id, name, manager_id, 1 as depth FROM employees WHERE manager_id IS NULL\\n  UNION ALL\\n  SELECT e.id, e.name, e.manager_id, ot.depth+1\\n  FROM employees e JOIN org_tree ot ON e.manager_id = ot.id\\n)\\nSELECT * FROM org_tree;" },
      { t: "Design a schema for a multi-tenant SaaS application", c: "-- Multi-tenant schema with row-level security\\nCREATE TABLE tenants (id INT PRIMARY KEY, name VARCHAR(100));\\nCREATE TABLE tenant_users (id INT, tenant_id INT REFERENCES tenants(id), email VARCHAR);\\nCREATE POLICY tenant_isolation ON tenant_users USING (tenant_id = current_tenant_id());" },
      { t: "Implement a materialized view refresh strategy", c: "-- Create and refresh a materialized view for analytics\\nCREATE MATERIALIZED VIEW sales_summary AS\\nSELECT product_id, SUM(qty) as total_qty, SUM(amount) as total_amount\\nFROM orders GROUP BY product_id;\\n-- REFRESH MATERIALIZED VIEW CONCURRENTLY sales_summary;" },
      { t: "Write a query to detect and resolve deadlock-prone patterns", c: "-- Identify long-running transactions that may cause deadlocks\\nSELECT pid, query, state, wait_event_type\\nFROM pg_stat_activity\\nWHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';" },
      { t: "Create a temporal table design for versioned records", c: "-- Temporal table with validity periods\\nCREATE TABLE products_history (\\n  id INT, name VARCHAR, price DECIMAL,\\n  valid_from TIMESTAMP, valid_to TIMESTAMP,\\n  PERIOD FOR validity (valid_from, valid_to)\\n);" },
      { t: "Build a full-text search query with ranking", c: "-- Full-text search with relevance ranking\\nSELECT id, title,\\n  ts_rank(to_tsvector(content), plainto_tsquery('distributed systems')) as rank\\nFROM articles\\nWHERE to_tsvector(content) @@ plainto_tsquery('distributed systems')\\nORDER BY rank DESC;" },
      { t: "Write a partitioned table strategy for time-series data", c: "-- Partition by month for time-series events\\nCREATE TABLE events (id INT, event_time TIMESTAMP, data JSONB)\\nPARTITION BY RANGE (event_time);\\nCREATE TABLE events_2024_01 PARTITION OF events\\nFOR VALUES FROM ('2024-01-01') TO ('2024-02-01');" },
      { t: "Implement row-level security policies for data isolation", c: "-- Row-level security for multi-tenant data\\nALTER TABLE orders ENABLE ROW LEVEL SECURITY;\\nCREATE POLICY tenant_access ON orders\\nUSING (tenant_id = current_setting('app.tenant_id')::INT);" },
      { t: "Create an efficient upsert (INSERT ON CONFLICT) pattern", c: "-- Upsert pattern for idempotent writes\\nINSERT INTO user_preferences (user_id, key, value)\\nVALUES (1, 'theme', 'dark')\\nON CONFLICT (user_id, key)\\nDO UPDATE SET value = EXCLUDED.value;" },
      { t: "Write a query to compute cumulative distribution", c: "-- Calculate cumulative distribution of order values\\nSELECT order_value,\\n  CUME_DIST() OVER (ORDER BY order_value) as cumulative_pct,\\n  NTILE(4) OVER (ORDER BY order_value) as quartile\\nFROM orders;" },
      { t: "Design an event sourcing schema with snapshots", c: "-- Event sourcing tables\\nCREATE TABLE events (id SERIAL, aggregate_id UUID, event_type VARCHAR, payload JSONB, created_at TIMESTAMP);\\nCREATE TABLE snapshots (aggregate_id UUID PRIMARY KEY, state JSONB, version INT, created_at TIMESTAMP);" },
      { t: "Implement a gap-and-island detection query", c: "-- Find consecutive date ranges (islands)\\nSELECT MIN(dt) as island_start, MAX(dt) as island_end\\nFROM (\\n  SELECT dt, dt - ROW_NUMBER() OVER(ORDER BY dt) * INTERVAL '1 day' as grp\\n  FROM attendance\\n) sub GROUP BY grp;" },
      { t: "Create a query plan analysis and optimization strategy", c: "-- Analyze and optimize a slow query\\nEXPLAIN ANALYZE\\nSELECT o.id, c.name, SUM(oi.quantity * oi.price)\\nFROM orders o\\nJOIN customers c ON o.customer_id = c.id\\nJOIN order_items oi ON o.id = oi.order_id\\nGROUP BY o.id, c.name;" },
      { t: "Write a lateral join for dependent subqueries", c: "-- Get top 3 orders per customer using LATERAL\\nSELECT c.name, top_orders.*\\nFROM customers c\\nCROSS JOIN LATERAL (\\n  SELECT id, total FROM orders\\n  WHERE customer_id = c.id\\n  ORDER BY total DESC LIMIT 3\\n) top_orders;" },
      { t: "Build a slowly changing dimension (SCD Type 2) update", c: "-- SCD Type 2: track historical changes\\nUPDATE dim_customer SET is_current = FALSE, end_date = CURRENT_DATE\\nWHERE customer_id = :id AND is_current = TRUE;\\nINSERT INTO dim_customer (customer_id, name, address, start_date, is_current)\\nVALUES (:id, :new_name, :new_addr, CURRENT_DATE, TRUE);" },
      { t: "Implement a deduplication query for near-duplicate detection", c: "-- Find near-duplicate records using similarity\\nSELECT a.id, b.id, a.name, b.name\\nFROM products a JOIN products b ON a.id < b.id\\nWHERE similarity(a.name, b.name) > 0.8;" },
      { t: "Create a JSON aggregation pipeline in SQL", c: "-- Aggregate related data into JSON\\nSELECT c.id, c.name,\\n  JSON_AGG(JSON_BUILD_OBJECT('order_id', o.id, 'total', o.total)) as orders\\nFROM customers c\\nJOIN orders o ON c.id = o.customer_id\\nGROUP BY c.id;" },
      { t: "Write a window function for session detection", c: "-- Detect user sessions (30min gap)\\nSELECT user_id, event_time,\\n  SUM(new_session) OVER(PARTITION BY user_id ORDER BY event_time) as session_id\\nFROM (\\n  SELECT *, CASE WHEN event_time - LAG(event_time) OVER(PARTITION BY user_id ORDER BY event_time) > INTERVAL '30 min' THEN 1 ELSE 0 END as new_session\\n  FROM events\\n) sub;" },
      { t: "Design a database migration strategy with zero downtime", c: "-- Zero-downtime migration steps\\n-- Step 1: Add new column\\nALTER TABLE users ADD COLUMN new_email VARCHAR;\\n-- Step 2: Backfill\\nUPDATE users SET new_email = email;\\n-- Step 3: Add constraint\\nALTER TABLE users ALTER COLUMN new_email SET NOT NULL;" },
    ];
    t.hard = [
      { t: "Implement a distributed transaction coordinator using 2PC pattern in SQL", c: "-- Two-phase commit pattern\\nCREATE TABLE tx_log (tx_id UUID, participant VARCHAR, status VARCHAR, updated_at TIMESTAMP);\\n-- Prepare phase: all participants vote\\n-- Commit phase: coordinator decides\\nSELECT tx_id, BOOL_AND(status = 'prepared') as can_commit\\nFROM tx_log GROUP BY tx_id;" },
      { t: "Design a graph traversal query engine using recursive CTEs", c: "-- Find all paths between two nodes\\nWITH RECURSIVE paths AS (\\n  SELECT start_node, end_node, ARRAY[start_node, end_node] as path, weight\\n  FROM edges WHERE start_node = :source\\n  UNION ALL\\n  SELECT p.start_node, e.end_node, p.path || e.end_node, p.weight + e.weight\\n  FROM paths p JOIN edges e ON p.end_node = e.start_node\\n  WHERE NOT e.end_node = ANY(p.path)\\n)\\nSELECT * FROM paths WHERE end_node = :target;" },
      { t: "Build a real-time leaderboard with efficient rank computation", c: "-- Efficient ranking with dense_rank\\nSELECT user_id, score,\\n  DENSE_RANK() OVER(ORDER BY score DESC) as rank,\\n  PERCENT_RANK() OVER(ORDER BY score DESC) as percentile\\nFROM leaderboard\\nWHERE updated_at > NOW() - INTERVAL '24 hours';" },
      { t: "Create an MVCC-aware query pattern for snapshot isolation", c: "-- MVCC pattern with version tracking\\nCREATE TABLE versioned_data (\\n  id INT, data JSONB, version INT, created_at TIMESTAMP, deleted_at TIMESTAMP\\n);\\n-- Read at snapshot\\nSELECT * FROM versioned_data\\nWHERE version <= :snapshot_version AND (deleted_at IS NULL OR deleted_at > :snapshot_time);" },
      { t: "Implement a change data capture (CDC) system using triggers", c: "-- CDC with trigger-based capture\\nCREATE TABLE cdc_events (id SERIAL, table_name VARCHAR, op VARCHAR, old_data JSONB, new_data JSONB, ts TIMESTAMP);\\nCREATE FUNCTION capture_changes() RETURNS TRIGGER AS $$\\nBEGIN\\n  INSERT INTO cdc_events VALUES (DEFAULT, TG_TABLE_NAME, TG_OP, row_to_json(OLD), row_to_json(NEW), NOW());\\n  RETURN NEW;\\nEND; $$ LANGUAGE plpgsql;" },
      { t: "Design a sharding strategy with consistent hash routing", c: "-- Shard routing function\\nCREATE FUNCTION get_shard(key TEXT, num_shards INT) RETURNS INT AS $$\\n  SELECT abs(hashtext(key)) %% num_shards;\\n$$ LANGUAGE sql;\\n-- Shard-aware query routing\\nSELECT * FROM orders_shard_0 WHERE get_shard(customer_id::TEXT, 4) = 0;" },
      { t: "Build a time-series compression query using delta encoding", c: "-- Delta encoding for time-series compression\\nSELECT timestamp, value,\\n  value - LAG(value) OVER(ORDER BY timestamp) as delta,\\n  timestamp - LAG(timestamp) OVER(ORDER BY timestamp) as time_delta\\nFROM sensor_readings\\nWHERE device_id = :device;" },
      { t: "Implement a conflict resolution strategy for CRDT-based tables", c: "-- Last-writer-wins conflict resolution\\nCREATE TABLE lww_register (\\n  key TEXT PRIMARY KEY, value JSONB, timestamp BIGINT, node_id TEXT\\n);\\nINSERT INTO lww_register VALUES (:key, :val, :ts, :node)\\nON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, timestamp = EXCLUDED.timestamp\\nWHERE EXCLUDED.timestamp > lww_register.timestamp;" },
      { t: "Create an advanced query optimizer hint system", c: "-- Manual query plan control\\nSELECT /*+ HashJoin(orders customers) IndexScan(orders idx_order_date) */\\n  c.name, SUM(o.total)\\nFROM orders o JOIN customers c ON o.customer_id = c.id\\nWHERE o.order_date > '2024-01-01'\\nGROUP BY c.name;" },
      { t: "Design a polyglot persistence query layer across SQL and NoSQL", c: "-- Federated query across SQL and external data\\nCREATE FOREIGN TABLE mongo_logs (\\n  id TEXT, level TEXT, message TEXT, timestamp TIMESTAMP\\n) SERVER mongo_server OPTIONS (collection 'logs');\\nSELECT u.name, l.message FROM users u\\nJOIN mongo_logs l ON u.id = l.user_id;" },
      { t: "Implement an incremental materialized view maintenance system", c: "-- Incremental view maintenance\\nCREATE TABLE mv_delta (op CHAR(1), product_id INT, qty_change INT);\\nUPDATE sales_summary s SET total_qty = s.total_qty + d.qty_change\\nFROM mv_delta d WHERE s.product_id = d.product_id AND d.op = 'U';" },
      { t: "Build a query-based anomaly detection system for transactions", c: "-- Detect anomalous transactions using statistical methods\\nWITH stats AS (\\n  SELECT user_id, AVG(amount) as avg_amt, STDDEV(amount) as std_amt\\n  FROM transactions GROUP BY user_id\\n)\\nSELECT t.* FROM transactions t\\nJOIN stats s ON t.user_id = s.user_id\\nWHERE t.amount > s.avg_amt + 3 * s.std_amt;" },
      { t: "Create a temporal join for as-of-date lookups", c: "-- As-of join: find price valid at order time\\nSELECT o.id, o.product_id, p.price\\nFROM orders o\\nJOIN LATERAL (\\n  SELECT price FROM price_history\\n  WHERE product_id = o.product_id AND valid_from <= o.order_date\\n  ORDER BY valid_from DESC LIMIT 1\\n) p ON TRUE;" },
      { t: "Design a bitmap index simulation for low-cardinality columns", c: "-- Bitmap index simulation\\nCREATE TABLE bitmap_idx (\\n  column_value TEXT, row_bitmap BIT VARYING\\n);\\n-- Query using bitmap AND\\nSELECT b1.row_bitmap & b2.row_bitmap as matching_rows\\nFROM bitmap_idx b1, bitmap_idx b2\\nWHERE b1.column_value = 'active' AND b2.column_value = 'premium';" },
      { t: "Implement a query-level encryption scheme for sensitive columns", c: "-- Column-level encryption\\nCREATE EXTENSION pgcrypto;\\nINSERT INTO patients (id, name_encrypted)\\nVALUES (:id, pgp_sym_encrypt(:name, :key));\\nSELECT id, pgp_sym_decrypt(name_encrypted::bytea, :key) as name\\nFROM patients;" },
      { t: "Build a distributed join optimization using bloom filter pre-filtering", c: "-- Bloom filter pre-filtering for distributed joins\\nWITH bloom AS (\\n  SELECT hashtext(customer_id::TEXT) %% 1024 as bucket\\n  FROM local_orders GROUP BY bucket\\n)\\nSELECT * FROM remote_customers\\nWHERE hashtext(id::TEXT) %% 1024 IN (SELECT bucket FROM bloom);" },
      { t: "Create a cursor-based pagination system for real-time feeds", c: "-- Cursor-based pagination\\nSELECT id, content, created_at FROM posts\\nWHERE created_at < :cursor_timestamp\\nOR (created_at = :cursor_timestamp AND id < :cursor_id)\\nORDER BY created_at DESC, id DESC LIMIT 20;" },
      { t: "Implement a write-optimized LSM-tree index strategy in SQL", c: "-- LSM-tree inspired write optimization\\nCREATE UNLOGGED TABLE memtable (key TEXT, value JSONB, seq BIGINT);\\nCREATE TABLE sstable_l0 (key TEXT, value JSONB, seq BIGINT);\\n-- Flush memtable to L0\\nINSERT INTO sstable_l0 SELECT * FROM memtable ORDER BY key;\\nTRUNCATE memtable;" },
      { t: "Design a multi-version schema migration with rollback support", c: "-- Versioned migration system\\nCREATE TABLE schema_versions (version INT PRIMARY KEY, applied_at TIMESTAMP, rollback_sql TEXT);\\nINSERT INTO schema_versions VALUES (42, NOW(),\\n  'ALTER TABLE users DROP COLUMN IF EXISTS preferences');\\nALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}';" },
      { t: "Build a query cost estimator based on table statistics", c: "-- Query cost estimation using table stats\\nSELECT relname, reltuples, relpages,\\n  reltuples / NULLIF(relpages, 0) as rows_per_page\\nFROM pg_class WHERE relname IN ('orders', 'customers');\\n-- Estimate join cost: pages(R) + pages(R) * pages(S)\\nSELECT r.relpages + r.relpages * s.relpages as nested_loop_cost\\nFROM pg_class r, pg_class s\\nWHERE r.relname = 'orders' AND s.relname = 'customers';" },
    ];
  } else {
    // Remaining skills get generated templates
    const defs = getCodeDefs(skill);
    t.easy = defs.easy;
    t.medium = defs.medium;
    t.hard = defs.hard;
  }
  return t;
}

function getCodeDefs(skill) {
  const map = {
    "JavaScript": {
      easy: [
        {t:"Implement a debounce function",c:"function debounce(fn, delay) {\\n  let timer;\\n  return function(...args) {\\n    clearTimeout(timer);\\n    timer = setTimeout(() => fn.apply(this, args), delay);\\n  };\\n}"},
        {t:"Create a deep clone utility without JSON",c:"function deepClone(obj) {\\n  // Handle arrays, objects, dates\\n  // Your code here\\n}"},
        {t:"Write a function to flatten a nested array",c:"function flatten(arr) {\\n  // Your code here\\n  return [];\\n}"},
        {t:"Implement a basic event emitter class",c:"class EventEmitter {\\n  constructor() { this.events = {}; }\\n  on(event, cb) { /* your code */ }\\n  emit(event, ...args) { /* your code */ }\\n}"},
        {t:"Create a throttle function",c:"function throttle(fn, limit) {\\n  // Your code here\\n}"},
        {t:"Write a curry function that works with any arity",c:"function curry(fn) {\\n  // Your code here\\n}"},
        {t:"Implement Array.prototype.reduce from scratch",c:"function myReduce(arr, fn, initial) {\\n  // Your code here\\n}"},
        {t:"Create a memoize wrapper for expensive functions",c:"function memoize(fn) {\\n  const cache = {};\\n  return function(...args) {\\n    // Your code here\\n  };\\n}"},
        {t:"Write a function to check object deep equality",c:"function deepEqual(a, b) {\\n  // Your code here\\n  return false;\\n}"},
        {t:"Implement a basic Observable pattern",c:"class Observable {\\n  constructor() { this.observers = []; }\\n  subscribe(fn) { /* your code */ }\\n  notify(data) { /* your code */ }\\n}"},
        {t:"Create a pipe function for function composition",c:"function pipe(...fns) {\\n  return (x) => fns.reduce((v, f) => f(v), x);\\n}"},
        {t:"Write a function to group array elements by a key",c:"function groupBy(arr, key) {\\n  // Your code here\\n  return {};\\n}"},
        {t:"Implement a simple template literal parser",c:"function template(str, vars) {\\n  // Replace {{key}} with vars[key]\\n  return '';\\n}"},
        {t:"Create a retry wrapper with configurable attempts",c:"async function retry(fn, attempts = 3) {\\n  // Your code here\\n}"},
        {t:"Write a function to convert callbacks to promises",c:"function promisify(fn) {\\n  return function(...args) {\\n    return new Promise((resolve, reject) => {\\n      // Your code here\\n    });\\n  };\\n}"},
        {t:"Implement a simple pub-sub message bus",c:"const bus = {\\n  subs: {},\\n  subscribe(topic, fn) { /* your code */ },\\n  publish(topic, data) { /* your code */ }\\n};"},
        {t:"Create a function to parse query string parameters",c:"function parseQueryString(qs) {\\n  // Your code here\\n  return {};\\n}"},
        {t:"Write an async queue that processes tasks sequentially",c:"class AsyncQueue {\\n  constructor() { this.queue = []; this.running = false; }\\n  enqueue(task) { /* your code */ }\\n  async process() { /* your code */ }\\n}"},
        {t:"Implement a basic router for URL pattern matching",c:"class Router {\\n  constructor() { this.routes = []; }\\n  add(pattern, handler) { /* your code */ }\\n  match(url) { /* your code */ }\\n}"},
        {t:"Create a lazy evaluation iterator",c:"function* lazyMap(iterable, fn) {\\n  // Your code here\\n}"},
      ],
      medium: [
        {t:"Implement Promise.all from scratch",c:"function promiseAll(promises) {\\n  return new Promise((resolve, reject) => {\\n    let results = [], completed = 0;\\n    promises.forEach((p, i) => {\\n      Promise.resolve(p).then(val => {\\n        results[i] = val;\\n        if (++completed === promises.length) resolve(results);\\n      }).catch(reject);\\n    });\\n  });\\n}"},
        {t:"Build a virtual DOM diff algorithm",c:"function diff(oldTree, newTree) {\\n  // Return patches array\\n  return [];\\n}"},
        {t:"Create a reactive state management system",c:"class Store {\\n  constructor(initialState) { this.state = initialState; this.listeners = []; }\\n  getState() { return this.state; }\\n  dispatch(action) { /* your code */ }\\n  subscribe(fn) { /* your code */ }\\n}"},
        {t:"Implement a middleware pipeline (Express-like)",c:"class App {\\n  constructor() { this.middlewares = []; }\\n  use(fn) { this.middlewares.push(fn); }\\n  handle(req, res) { /* chain middlewares */ }\\n}"},
        {t:"Write a JSON patch (RFC 6902) implementation",c:"function applyPatch(doc, patches) {\\n  // Handle add, remove, replace, move\\n  return doc;\\n}"},
        {t:"Create a worker thread pool manager",c:"class WorkerPool {\\n  constructor(size) { /* init workers */ }\\n  execute(task) { /* assign to idle worker */ }\\n  terminate() { /* cleanup */ }\\n}"},
        {t:"Implement a finite state machine",c:"class FSM {\\n  constructor(config) { this.state = config.initial; this.transitions = config.transitions; }\\n  transition(event) { /* your code */ }\\n  getState() { return this.state; }\\n}"},
        {t:"Build a dependency injection container",c:"class Container {\\n  constructor() { this.registry = {}; }\\n  register(name, factory, deps = []) { /* your code */ }\\n  resolve(name) { /* your code */ }\\n}"},
        {t:"Create an async iterator for paginated API calls",c:"async function* paginatedFetch(baseUrl) {\\n  let page = 1, hasMore = true;\\n  while (hasMore) {\\n    // Fetch page and yield results\\n  }\\n}"},
        {t:"Implement a trie-based autocomplete engine",c:"class Trie {\\n  constructor() { this.root = {}; }\\n  insert(word) { /* your code */ }\\n  suggest(prefix) { /* return suggestions */ return []; }\\n}"},
        {t:"Write a custom JSON serializer with circular reference handling",c:"function safeStringify(obj) {\\n  const seen = new WeakSet();\\n  return JSON.stringify(obj, (key, val) => {\\n    // Handle circular refs\\n  });\\n}"},
        {t:"Create a rate-limited API client",c:"class RateLimitedClient {\\n  constructor(rps) { this.rps = rps; this.queue = []; }\\n  async request(url, options) { /* throttle requests */ }\\n}"},
        {t:"Implement an LRU cache with Map",c:"class LRUCache {\\n  constructor(capacity) { this.capacity = capacity; this.cache = new Map(); }\\n  get(key) { /* your code */ }\\n  put(key, value) { /* your code */ }\\n}"},
        {t:"Build a schema validator for nested objects",c:"function validate(data, schema) {\\n  // Validate types, required fields, nested objects\\n  return { valid: true, errors: [] };\\n}"},
        {t:"Create a cancelable promise wrapper",c:"function makeCancelable(promise) {\\n  let cancel;\\n  const wrapped = new Promise((resolve, reject) => {\\n    cancel = () => reject({ canceled: true });\\n    promise.then(resolve, reject);\\n  });\\n  return { promise: wrapped, cancel };\\n}"},
        {t:"Implement a bidirectional linked list with iterator protocol",c:"class LinkedList {\\n  constructor() { this.head = null; this.tail = null; }\\n  append(val) { /* your code */ }\\n  [Symbol.iterator]() { /* your code */ }\\n}"},
        {t:"Write a proxy-based change detection system",c:"function reactive(obj, onChange) {\\n  return new Proxy(obj, {\\n    set(target, prop, value) {\\n      // Detect and notify changes\\n    }\\n  });\\n}"},
        {t:"Create a task scheduler with priority and dependencies",c:"class Scheduler {\\n  constructor() { this.tasks = []; }\\n  addTask(name, priority, deps, fn) { /* your code */ }\\n  async run() { /* resolve deps and execute */ }\\n}"},
        {t:"Implement a streaming data transformer pipeline",c:"class Pipeline {\\n  constructor() { this.transforms = []; }\\n  pipe(transform) { this.transforms.push(transform); return this; }\\n  async execute(source) { /* your code */ }\\n}"},
        {t:"Build a command pattern with undo/redo support",c:"class CommandManager {\\n  constructor() { this.history = []; this.redoStack = []; }\\n  execute(command) { /* your code */ }\\n  undo() { /* your code */ }\\n  redo() { /* your code */ }\\n}"},
      ],
      hard: [
        {t:"Create a reactive virtual DOM rendering engine",c:"function createElement(type, props, ...children) { /* your code */ }\\nfunction render(vdom, container) { /* your code */ }\\nfunction reconcile(oldVdom, newVdom) { /* your code */ }"},
        {t:"Implement a JavaScript bytecode interpreter",c:"class VM {\\n  constructor() { this.stack = []; this.ip = 0; }\\n  execute(bytecode) { /* interpret opcodes */ }\\n}"},
        {t:"Build a cooperative multitasking scheduler using generators",c:"class Scheduler {\\n  constructor() { this.tasks = []; }\\n  spawn(generatorFn) { /* add task */ }\\n  run() { /* round-robin schedule */ }\\n}"},
        {t:"Create a compile-time type checker for a mini language",c:"function typeCheck(ast) {\\n  // Walk AST and verify types\\n  return { errors: [] };\\n}"},
        {t:"Implement a garbage collector simulator with mark-and-sweep",c:"class GC {\\n  constructor() { this.heap = []; this.roots = []; }\\n  allocate(size) { /* your code */ }\\n  mark() { /* mark reachable */ }\\n  sweep() { /* free unreachable */ }\\n}"},
        {t:"Build a WebSocket protocol implementation from TCP",c:"class WebSocketServer {\\n  constructor(port) { /* setup TCP */ }\\n  handleUpgrade(req) { /* HTTP upgrade handshake */ }\\n  send(client, data) { /* frame and send */ }\\n  receive(client) { /* parse frames */ }\\n}"},
        {t:"Create a source map generator for a transpiler",c:"class SourceMapGenerator {\\n  constructor() { this.mappings = []; }\\n  addMapping(original, generated) { /* your code */ }\\n  toJSON() { /* output source map format */ }\\n}"},
        {t:"Implement a concurrent data structure using SharedArrayBuffer",c:"class SharedCounter {\\n  constructor(sab) { this.view = new Int32Array(sab); }\\n  increment() { Atomics.add(this.view, 0, 1); }\\n  get() { return Atomics.load(this.view, 0); }\\n}"},
        {t:"Build a module bundler that resolves dependencies",c:"class Bundler {\\n  constructor(entry) { this.entry = entry; }\\n  buildGraph() { /* resolve imports */ }\\n  bundle() { /* concatenate modules */ return ''; }\\n}"},
        {t:"Create an incremental parser for a streaming JSON protocol",c:"class IncrementalJSONParser {\\n  constructor() { this.buffer = ''; this.state = 'VALUE'; }\\n  write(chunk) { /* parse incrementally */ }\\n  onValue(callback) { /* emit parsed values */ }\\n}"},
        {t:"Implement a snapshot testing framework",c:"class SnapshotTester {\\n  constructor(dir) { this.dir = dir; }\\n  matchSnapshot(name, value) { /* compare or create */ }\\n  updateSnapshots() { /* overwrite stored */ }\\n}"},
        {t:"Build an actor model framework using Web Workers",c:"class ActorSystem {\\n  constructor() { this.actors = new Map(); }\\n  spawn(behavior) { /* create worker actor */ }\\n  send(actorId, message) { /* route message */ }\\n}"},
        {t:"Create a persistent immutable data structure library",c:"class PersistentVector {\\n  constructor(root, size) { /* trie-based */ }\\n  get(index) { /* path copy lookup */ }\\n  set(index, val) { /* return new version */ }\\n  push(val) { /* structural sharing */ }\\n}"},
        {t:"Implement a regex engine supporting groups and quantifiers",c:"class RegexEngine {\\n  constructor(pattern) { this.ast = this.parse(pattern); }\\n  parse(pattern) { /* build NFA */ }\\n  match(input) { /* simulate NFA */ return false; }\\n}"},
        {t:"Build a code coverage instrumentation tool",c:"class CoverageInstrumenter {\\n  constructor() { this.coverage = {}; }\\n  instrument(source) { /* inject counters */ return source; }\\n  report() { /* generate coverage report */ }\\n}"},
        {t:"Create a distributed consensus algorithm simulator",c:"class PaxosNode {\\n  constructor(id, peers) { this.id = id; this.peers = peers; }\\n  propose(value) { /* phase 1: prepare */ }\\n  accept(proposal) { /* phase 2: accept */ }\\n}"},
        {t:"Implement a JIT-like optimization for hot code paths",c:"class HotPathOptimizer {\\n  constructor() { this.callCounts = {}; }\\n  track(fnName) { /* count invocations */ }\\n  optimize(fnName, fn) { /* create specialized version */ }\\n}"},
        {t:"Build a capability-based security sandbox",c:"class Sandbox {\\n  constructor(capabilities) { this.caps = capabilities; }\\n  execute(code) { /* run with restricted access */ }\\n  grant(capability) { /* add capability */ }\\n  revoke(capability) { /* remove capability */ }\\n}"},
        {t:"Create a time-travel debugger for state changes",c:"class TimeTravelDebugger {\\n  constructor() { this.snapshots = []; this.current = -1; }\\n  record(state) { /* save snapshot */ }\\n  stepBack() { /* restore previous */ }\\n  stepForward() { /* restore next */ }\\n  inspect(index) { /* view state at point */ }\\n}"},
        {t:"Implement a WebAssembly module loader and linker",c:"class WasmLinker {\\n  constructor() { this.modules = {}; }\\n  async load(name, url) { /* fetch and compile */ }\\n  link(imports) { /* resolve imports across modules */ }\\n  instantiate(name) { /* create instance */ }\\n}"},
      ]
    },
    "TypeScript": {
      easy: [
        {t:"Create a type-safe generic Map wrapper",c:"class SafeMap<K, V> {\\n  private map = new Map<K, V>();\\n  set(key: K, value: V): void { this.map.set(key, value); }\\n  get(key: K): V | undefined { return this.map.get(key); }\\n}"},
        {t:"Implement a Result type for error handling",c:"type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };\\nfunction ok<T>(value: T): Result<T, never> { return { ok: true, value }; }\\nfunction err<E>(error: E): Result<never, E> { return { ok: false, error }; }"},
        {t:"Write a generic Stack with type constraints",c:"class Stack<T> {\\n  private items: T[] = [];\\n  push(item: T): void { /* your code */ }\\n  pop(): T | undefined { /* your code */ return undefined; }\\n  peek(): T | undefined { return this.items[this.items.length - 1]; }\\n}"},
        {t:"Create a typed configuration loader",c:"interface Config { port: number; host: string; debug: boolean; }\\nfunction loadConfig(env: Record<string, string>): Config {\\n  // Parse and validate environment variables\\n  return { port: 0, host: '', debug: false };\\n}"},
        {t:"Implement a type-safe builder pattern",c:"class QueryBuilder<T extends Record<string, any>> {\\n  private conditions: Partial<T> = {};\\n  where<K extends keyof T>(key: K, value: T[K]): this { /* your code */ return this; }\\n  build(): Partial<T> { return this.conditions; }\\n}"},
        {t:"Write a discriminated union for API responses",c:"type ApiResponse<T> =\\n  | { status: 'success'; data: T }\\n  | { status: 'error'; message: string }\\n  | { status: 'loading' };\\nfunction handleResponse<T>(res: ApiResponse<T>): T | null {\\n  // Your code here\\n  return null;\\n}"},
        {t:"Create a generic repository interface",c:"interface Repository<T, ID> {\\n  findById(id: ID): Promise<T | null>;\\n  findAll(): Promise<T[]>;\\n  save(entity: T): Promise<T>;\\n  delete(id: ID): Promise<boolean>;\\n}"},
        {t:"Implement a typed event emitter",c:"class TypedEventEmitter<Events extends Record<string, any[]>> {\\n  private handlers: Partial<{ [K in keyof Events]: Array<(...args: Events[K]) => void> }> = {};\\n  on<K extends keyof Events>(event: K, handler: (...args: Events[K]) => void): void { /* your code */ }\\n  emit<K extends keyof Events>(event: K, ...args: Events[K]): void { /* your code */ }\\n}"},
        {t:"Write a generic linked list with type safety",c:"class ListNode<T> { constructor(public value: T, public next: ListNode<T> | null = null) {} }\\nclass LinkedList<T> {\\n  private head: ListNode<T> | null = null;\\n  append(value: T): void { /* your code */ }\\n  toArray(): T[] { /* your code */ return []; }\\n}"},
        {t:"Create a type-safe enum utility",c:"function createEnum<T extends string>(...values: T[]): { [K in T]: K } {\\n  // Build enum object from values\\n  return {} as any;\\n}"},
        {t:"Implement branded types for type-safe IDs",c:"type Brand<T, B> = T & { __brand: B };\\ntype UserId = Brand<string, 'UserId'>;\\ntype OrderId = Brand<string, 'OrderId'>;\\nfunction createUserId(id: string): UserId { return id as UserId; }"},
        {t:"Write a generic Either type",c:"type Either<L, R> = { tag: 'left'; value: L } | { tag: 'right'; value: R };\\nfunction left<L>(value: L): Either<L, never> { return { tag: 'left', value }; }\\nfunction right<R>(value: R): Either<never, R> { return { tag: 'right', value }; }"},
        {t:"Create a typed localStorage wrapper",c:"class TypedStorage<T extends Record<string, any>> {\\n  get<K extends keyof T>(key: K): T[K] | null { /* your code */ return null; }\\n  set<K extends keyof T>(key: K, value: T[K]): void { /* your code */ }\\n}"},
        {t:"Implement a generic observer pattern",c:"interface Observer<T> { update(data: T): void; }\\nclass Subject<T> {\\n  private observers: Observer<T>[] = [];\\n  attach(obs: Observer<T>): void { /* your code */ }\\n  notify(data: T): void { /* your code */ }\\n}"},
        {t:"Write a type guard utility for runtime type checking",c:"function isString(val: unknown): val is string { return typeof val === 'string'; }\\nfunction isArrayOf<T>(arr: unknown, guard: (v: unknown) => v is T): arr is T[] {\\n  return Array.isArray(arr) && arr.every(guard);\\n}"},
        {t:"Create a generic tree node structure",c:"class TreeNode<T> {\\n  children: TreeNode<T>[] = [];\\n  constructor(public value: T) {}\\n  addChild(value: T): TreeNode<T> { /* your code */ return new TreeNode(value); }\\n  find(predicate: (v: T) => boolean): TreeNode<T> | null { /* your code */ return null; }\\n}"},
        {t:"Implement a type-safe dependency map",c:"type DependencyMap = {\\n  [key: string]: { factory: () => any; singleton?: boolean; instance?: any };\\n};\\nclass Container {\\n  private deps: DependencyMap = {};\\n  register<T>(name: string, factory: () => T): void { /* your code */ }\\n  resolve<T>(name: string): T { /* your code */ return {} as T; }\\n}"},
        {t:"Write a generic comparator and sorter",c:"type Comparator<T> = (a: T, b: T) => number;\\nfunction sortBy<T, K extends keyof T>(arr: T[], key: K): T[] {\\n  return arr.sort((a, b) => (a[key] > b[key] ? 1 : -1));\\n}"},
        {t:"Create a typed fetch wrapper with generics",c:"async function typedFetch<T>(url: string, options?: RequestInit): Promise<T> {\\n  const res = await fetch(url, options);\\n  if (!res.ok) throw new Error(res.statusText);\\n  return res.json() as Promise<T>;\\n}"},
        {t:"Implement a generic queue with peek",c:"class Queue<T> {\\n  private items: T[] = [];\\n  enqueue(item: T): void { this.items.push(item); }\\n  dequeue(): T | undefined { return this.items.shift(); }\\n  peek(): T | undefined { return this.items[0]; }\\n  get size(): number { return this.items.length; }\\n}"},
      ],
      medium: [
        {t:"Create a recursive DeepPartial utility type",c:"type DeepPartial<T> = {\\n  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];\\n};"},
        {t:"Implement a type-safe Redux-like store",c:"type Reducer<S, A> = (state: S, action: A) => S;\\nclass Store<S, A> {\\n  private state: S;\\n  private listeners: Array<() => void> = [];\\n  constructor(private reducer: Reducer<S, A>, initialState: S) { this.state = initialState; }\\n  dispatch(action: A): void { /* your code */ }\\n  getState(): S { return this.state; }\\n}"},
        {t:"Build a type-safe ORM query builder",c:"type WhereClause<T> = Partial<{ [K in keyof T]: T[K] | { $gt: T[K] } | { $lt: T[K] } }>;\\nclass QueryBuilder<T> {\\n  private _where: WhereClause<T> = {};\\n  where(clause: WhereClause<T>): this { /* your code */ return this; }\\n  toSQL(): string { /* generate SQL */ return ''; }\\n}"},
        {t:"Create a conditional type-based API route handler",c:"type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';\\ntype RouteHandler<M extends Method> = M extends 'GET' ? { query: Record<string, string> } : { body: unknown };\\nfunction createHandler<M extends Method>(method: M, handler: (req: RouteHandler<M>) => void): void { /* your code */ }"},
        {t:"Implement a type-safe state machine with transitions",c:"type StateMachine<States extends string, Events extends string> = {\\n  initial: States;\\n  states: Record<States, { on: Partial<Record<Events, States>> }>;\\n};\\nfunction createMachine<S extends string, E extends string>(config: StateMachine<S, E>) { /* your code */ }"},
        {t:"Build a mapped type for form validation schema",c:"type ValidationSchema<T> = {\\n  [K in keyof T]: {\\n    required?: boolean;\\n    validate?: (value: T[K]) => boolean;\\n    message?: string;\\n  };\\n};\\nfunction validateForm<T>(data: T, schema: ValidationSchema<T>): { valid: boolean; errors: Partial<Record<keyof T, string>> } { /* your code */ return { valid: true, errors: {} }; }"},
        {t:"Create template literal types for a CSS-in-JS engine",c:"type CSSProperty = 'color' | 'fontSize' | 'margin' | 'padding';\\ntype CSSValue = `${number}px` | `${number}rem` | string;\\ntype StyleSheet = Partial<Record<CSSProperty, CSSValue>>;\\nfunction css(styles: StyleSheet): string { /* your code */ return ''; }"},
        {t:"Implement a type-safe middleware chain",c:"type Middleware<Ctx> = (ctx: Ctx, next: () => Promise<void>) => Promise<void>;\\nclass MiddlewareChain<Ctx> {\\n  private stack: Middleware<Ctx>[] = [];\\n  use(mw: Middleware<Ctx>): void { this.stack.push(mw); }\\n  async execute(ctx: Ctx): Promise<void> { /* chain execution */ }\\n}"},
        {t:"Build a type-safe path parameter extractor",c:"type ExtractParams<T extends string> = T extends `${infer _}:${infer Param}/${infer Rest}`\\n  ? { [K in Param | keyof ExtractParams<Rest>]: string }\\n  : T extends `${infer _}:${infer Param}` ? { [K in Param]: string } : {};\\nfunction extractParams<T extends string>(pattern: T, url: string): ExtractParams<T> { return {} as any; }"},
        {t:"Create a variance-safe collection hierarchy",c:"interface ReadonlyRepo<out T> { find(id: string): T; }\\ninterface MutableRepo<T> extends ReadonlyRepo<T> { save(entity: T): void; }\\nclass InMemoryRepo<T extends { id: string }> implements MutableRepo<T> {\\n  private store = new Map<string, T>();\\n  find(id: string): T { /* your code */ return {} as T; }\\n  save(entity: T): void { /* your code */ }\\n}"},
        {t:"Implement a generic retry with exponential backoff",c:"interface RetryConfig { maxAttempts: number; baseDelay: number; }\\nasync function retryWithBackoff<T>(fn: () => Promise<T>, config: RetryConfig): Promise<T> {\\n  // Your code here\\n  return {} as T;\\n}"},
        {t:"Build infer-based response type extraction",c:"type ApiEndpoints = {\\n  '/users': { response: { id: string; name: string }[] };\\n  '/orders': { response: { id: string; total: number }[] };\\n};\\ntype ResponseType<P extends keyof ApiEndpoints> = ApiEndpoints[P]['response'];\\nasync function fetchApi<P extends keyof ApiEndpoints>(path: P): Promise<ResponseType<P>> { return {} as any; }"},
        {t:"Create a type-safe command pattern",c:"interface Command<T> { execute(): T; undo(): void; }\\nclass CommandHistory {\\n  private stack: Command<any>[] = [];\\n  execute<T>(cmd: Command<T>): T { /* your code */ return {} as T; }\\n  undo(): void { /* your code */ }\\n}"},
        {t:"Implement a deep readonly recursive type",c:"type DeepReadonly<T> = {\\n  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];\\n};\\nfunction freeze<T extends object>(obj: T): DeepReadonly<T> { /* your code */ return obj as any; }"},
        {t:"Build a plugin system with typed hooks",c:"interface Plugin<Hooks extends Record<string, (...args: any[]) => any>> {\\n  name: string;\\n  hooks: Partial<Hooks>;\\n}\\nclass PluginSystem<H extends Record<string, (...args: any[]) => any>> {\\n  private plugins: Plugin<H>[] = [];\\n  register(plugin: Plugin<H>): void { /* your code */ }\\n  call<K extends keyof H>(hook: K, ...args: Parameters<H[K]>): ReturnType<H[K]>[] { return []; }\\n}"},
        {t:"Create a variadic tuple type for function composition",c:"type Compose<Fns extends Array<(arg: any) => any>> = Fns extends [infer F, ...infer Rest]\\n  ? F extends (arg: infer A) => infer R ? (arg: A) => any : never : never;\\nfunction compose<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {\\n  return (x) => fns.reduceRight((v, f) => f(v), x);\\n}"},
        {t:"Implement a type-safe event sourcing system",c:"interface DomainEvent<T extends string, P> { type: T; payload: P; timestamp: number; }\\ntype EventHandler<E extends DomainEvent<string, any>> = (event: E) => void;\\nclass EventStore<Events extends DomainEvent<string, any>> {\\n  private events: Events[] = [];\\n  append(event: Events): void { /* your code */ }\\n  replay(handler: EventHandler<Events>): void { /* your code */ }\\n}"},
        {t:"Build a typed JSON schema validator",c:"type JSONSchema = { type: 'string' | 'number' | 'boolean' | 'object'; properties?: Record<string, JSONSchema>; required?: string[]; };\\ntype InferType<S extends JSONSchema> = S['type'] extends 'string' ? string : S['type'] extends 'number' ? number : any;\\nfunction validate<S extends JSONSchema>(data: unknown, schema: S): data is InferType<S> { return true; }"},
        {t:"Create a type narrowing utility for tagged unions",c:"type Tagged<Tag extends string, T> = T & { _tag: Tag };\\nfunction match<T extends { _tag: string }>(value: T) {\\n  return {\\n    case: <Tag extends T['_tag']>(tag: Tag, fn: (v: Extract<T, { _tag: Tag }>) => any) => {\\n      /* your code */\\n    }\\n  };\\n}"},
        {t:"Implement a generic data access layer with transactions",c:"interface Transaction { commit(): Promise<void>; rollback(): Promise<void>; }\\ninterface DataAccess<T> {\\n  inTransaction<R>(fn: (tx: Transaction) => Promise<R>): Promise<R>;\\n  findMany(filter: Partial<T>): Promise<T[]>;\\n}"},
      ],
      hard: [
        {t:"Implement a type-safe event emitter with strict contracts",c:"class StrictEmitter<Events extends Record<string, any>> {\\n  private handlers = new Map<keyof Events, Set<Function>>();\\n  on<K extends keyof Events>(event: K, fn: (data: Events[K]) => void): void { /* your code */ }\\n  emit<K extends keyof Events>(event: K, data: Events[K]): void { /* your code */ }\\n}"},
        {t:"Build a type-level SQL query builder",c:"type Table<Name extends string, Cols extends Record<string, any>> = { name: Name; columns: Cols };\\ntype SelectQuery<T extends Table<string, any>, K extends keyof T['columns']> = Pick<T['columns'], K>;\\nfunction select<T extends Table<string, any>, K extends keyof T['columns']>(table: T, ...cols: K[]): SelectQuery<T, K>[] { return []; }"},
        {t:"Create a compile-time dependency graph resolver",c:"type DepGraph<T extends Record<string, string[]>> = T;\\ntype TopSort<G extends DepGraph<any>> = string[];\\nfunction resolveDeps<G extends Record<string, string[]>>(graph: G): string[] { /* topological sort */ return []; }"},
        {t:"Implement a type-safe GraphQL resolver map",c:"type ResolverMap<Schema extends Record<string, Record<string, any>>> = {\\n  [Type in keyof Schema]: {\\n    [Field in keyof Schema[Type]]: (parent: any, args: any) => Schema[Type][Field] | Promise<Schema[Type][Field]>;\\n  };\\n};"},
        {t:"Build a HKT (Higher-Kinded Types) encoding in TypeScript",c:"interface HKT<URI, A> { readonly _URI: URI; readonly _A: A; }\\ninterface Functor<F extends string> {\\n  map<A, B>(fa: HKT<F, A>, f: (a: A) => B): HKT<F, B>;\\n}"},
        {t:"Create a type-safe effect system with algebraic effects",c:"type Effect<Tag extends string, A> = { tag: Tag; resume: (value: A) => void };\\nclass EffectRunner {\\n  private handlers = new Map<string, Function>();\\n  handle<T extends string>(tag: T, handler: Function): void { /* your code */ }\\n  run<T>(computation: Generator<Effect<string, any>, T>): T { return {} as T; }\\n}"},
        {t:"Implement a phantom type based unit system",c:"type Unit<U extends string> = number & { __unit: U };\\ntype Meters = Unit<'m'>;\\ntype Seconds = Unit<'s'>;\\ntype MetersPerSecond = Unit<'m/s'>;\\nfunction divide<A extends string, B extends string>(a: Unit<A>, b: Unit<B>): Unit<`${A}/${B}`> { return (a as number / (b as number)) as any; }"},
        {t:"Build a type-level parser combinator library",c:"type Parser<T> = (input: string) => { result: T; rest: string } | null;\\nfunction seq<A, B>(pa: Parser<A>, pb: Parser<B>): Parser<[A, B]> { return (input) => { /* your code */ return null; }; }\\nfunction alt<A, B>(pa: Parser<A>, pb: Parser<B>): Parser<A | B> { return (input) => pa(input) || pb(input); }"},
        {t:"Create a GADT-style encoding for typed expressions",c:"type Expr<T> = { tag: 'num'; value: number } | { tag: 'bool'; value: boolean } | { tag: 'add'; left: Expr<number>; right: Expr<number> } | { tag: 'eq'; left: Expr<any>; right: Expr<any> };\\nfunction evaluate<T>(expr: Expr<T>): T { /* your code */ return {} as T; }"},
        {t:"Implement a type-safe optics library (Lens/Prism)",c:"type Lens<S, A> = { get: (s: S) => A; set: (a: A) => (s: S) => S };\\nfunction prop<S, K extends keyof S>(key: K): Lens<S, S[K]> {\\n  return { get: (s) => s[key], set: (a) => (s) => ({ ...s, [key]: a }) };\\n}\\nfunction compose<A, B, C>(ab: Lens<A, B>, bc: Lens<B, C>): Lens<A, C> { /* your code */ return {} as any; }"},
        {t:"Build a type-safe finite automaton with state transitions",c:"type Automaton<States extends string, Alphabet extends string, Trans extends Record<States, Partial<Record<Alphabet, States>>>> = {\\n  states: States[]; initial: States; accepting: States[]; transitions: Trans;\\n};\\nfunction accepts<S extends string, A extends string, T extends Record<S, Partial<Record<A, S>>>>(auto: Automaton<S, A, T>, input: A[]): boolean { return false; }"},
        {t:"Create a monad transformer stack type",c:"interface Monad<M> { of<A>(a: A): HKT2<M, A>; chain<A, B>(ma: HKT2<M, A>, f: (a: A) => HKT2<M, B>): HKT2<M, B>; }\\ninterface HKT2<M, A> { _M: M; _A: A; }\\nfunction monadTransformer<M, N>(outer: Monad<M>, inner: Monad<N>) { /* compose monads */ }"},
        {t:"Implement a type-level regular expression matcher",c:"type Match<Pattern extends string, Input extends string> = Pattern extends ''\\n  ? Input extends '' ? true : false\\n  : Pattern extends `${infer P}${infer PRest}`\\n    ? Input extends `${infer I}${infer IRest}`\\n      ? P extends I ? Match<PRest, IRest> : false\\n      : false\\n    : false;"},
        {t:"Build a type-safe actor system with message protocols",c:"type Protocol<Messages extends Record<string, any>> = Messages;\\nclass Actor<P extends Record<string, any>> {\\n  receive<K extends keyof P>(type: K, handler: (msg: P[K]) => void): void { /* your code */ }\\n  send<K extends keyof P>(target: Actor<any>, type: K, msg: P[K]): void { /* your code */ }\\n}"},
        {t:"Create a structural subtyping checker at runtime",c:"type TypeDef = { kind: 'primitive'; type: string } | { kind: 'object'; fields: Record<string, TypeDef> };\\nfunction isSubtype(sub: TypeDef, sup: TypeDef): boolean { /* structural check */ return false; }\\nfunction checkAssignment(target: TypeDef, source: TypeDef): { compatible: boolean; errors: string[] } { return { compatible: false, errors: [] }; }"},
        {t:"Implement a free monad for building DSLs",c:"type Free<F, A> = { tag: 'Pure'; value: A } | { tag: 'Suspend'; value: F; next: (result: any) => Free<F, A> };\\nfunction pure<F, A>(a: A): Free<F, A> { return { tag: 'Pure', value: a }; }\\nfunction suspend<F, A>(f: F, next: (r: any) => Free<F, A>): Free<F, A> { return { tag: 'Suspend', value: f, next }; }\\nfunction interpret<F, A>(program: Free<F, A>, handler: (f: F) => any): A { return {} as A; }"},
        {t:"Build a heterogeneous list type with type-safe operations",c:"type HList = [] | [any, ...any[]];\\ntype Head<L extends HList> = L extends [infer H, ...any[]] ? H : never;\\ntype Tail<L extends HList> = L extends [any, ...infer T] ? T : never;\\ntype Concat<A extends any[], B extends any[]> = [...A, ...B];\\nfunction head<H, T extends any[]>(list: [H, ...T]): H { return list[0]; }\\nfunction tail<H, T extends any[]>(list: [H, ...T]): T { return list.slice(1) as T; }"},
        {t:"Create a type-safe serialization/deserialization codec",c:"interface Codec<A, O = A> {\\n  encode(value: A): O;\\n  decode(raw: unknown): A;\\n}\\nfunction object<P extends Record<string, Codec<any>>>(props: P): Codec<{ [K in keyof P]: P[K] extends Codec<infer A> ? A : never }> { return {} as any; }\\nfunction array<A>(codec: Codec<A>): Codec<A[]> { return {} as any; }"},
        {t:"Implement type-level arithmetic operations",c:"type BuildTuple<N extends number, T extends any[] = []> = T['length'] extends N ? T : BuildTuple<N, [...T, any]>;\\ntype Add<A extends number, B extends number> = [...BuildTuple<A>, ...BuildTuple<B>]['length'];\\ntype Subtract<A extends number, B extends number> = BuildTuple<A> extends [...BuildTuple<B>, ...infer R] ? R['length'] : never;"},
        {t:"Build a type-safe SQL migration runner",c:"interface Migration { version: number; up: string; down: string; }\\nclass MigrationRunner {\\n  constructor(private migrations: Migration[]) {}\\n  async migrate(targetVersion: number): Promise<void> { /* run up/down */ }\\n  validate(): { valid: boolean; gaps: number[] } { /* check sequence */ return { valid: true, gaps: [] }; }\\n}"},
      ]
    },
  };

  // For remaining skills, build generic templates
  const remaining = {
    "Go": { lang: "go", ext: "go", comment: "//" },
    "Rust": { lang: "rust", ext: "rs", comment: "//" },
    "C++": { lang: "cpp", ext: "cpp", comment: "//" },
    "Docker": { lang: "dockerfile", ext: "Dockerfile", comment: "#" },
    "Kubernetes": { lang: "yaml", ext: "yaml", comment: "#" },
    "AWS": { lang: "json", ext: "json", comment: "//" },
    "React": { lang: "jsx", ext: "jsx", comment: "//" },
    "Node.js": { lang: "javascript", ext: "js", comment: "//" },
    "HTML5 & CSS3": { lang: "html", ext: "html", comment: "<!--" },
  };

  if (map[skill]) return map[skill];

  // Generate from compact definitions for remaining skills
  return getCompactSkillDefs(skill);
}

function getCompactSkillDefs(skill) {
  const defs = {
    "Go": {
      easy: [
        {t:"Implement a concurrent worker pool with goroutines",c:"package main\\n\\nfunc worker(id int, jobs <-chan int, results chan<- int) {\\n\\tfor j := range jobs {\\n\\t\\tresults <- j * 2\\n\\t}\\n}"},
        {t:"Create a basic HTTP server with middleware support",c:"package main\\n\\nimport \"net/http\"\\n\\nfunc loggingMiddleware(next http.Handler) http.Handler {\\n\\treturn http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {\\n\\t\\t// Log request then call next\\n\\t\\tnext.ServeHTTP(w, r)\\n\\t})\\n}"},
        {t:"Write a function to reverse a string handling unicode",c:"package main\\n\\nfunc reverseString(s string) string {\\n\\trunes := []rune(s)\\n\\t// Your code here\\n\\treturn string(runes)\\n}"},
        {t:"Implement a generic stack using Go generics",c:"package main\\n\\ntype Stack[T any] struct {\\n\\titems []T\\n}\\nfunc (s *Stack[T]) Push(item T) { /* your code */ }\\nfunc (s *Stack[T]) Pop() (T, bool) { /* your code */ var zero T; return zero, false }"},
        {t:"Create a concurrent-safe map wrapper",c:"package main\\n\\nimport \"sync\"\\n\\ntype SafeMap[K comparable, V any] struct {\\n\\tmu sync.RWMutex\\n\\tdata map[K]V\\n}\\nfunc (m *SafeMap[K, V]) Get(key K) (V, bool) { /* your code */ var zero V; return zero, false }\\nfunc (m *SafeMap[K, V]) Set(key K, val V) { /* your code */ }"},
        {t:"Write a CLI argument parser using flag package",c:"package main\\n\\nimport \"flag\"\\n\\nfunc parseArgs() {\\n\\tport := flag.Int(\"port\", 8080, \"server port\")\\n\\t// Add more flags\\n\\tflag.Parse()\\n\\t_ = port\\n}"},
        {t:"Implement a simple in-memory key-value store",c:"package main\\n\\ntype KVStore struct {\\n\\tstore map[string]string\\n}\\nfunc (kv *KVStore) Get(key string) (string, bool) { /* your code */ return \"\", false }\\nfunc (kv *KVStore) Set(key, val string) { /* your code */ }\\nfunc (kv *KVStore) Delete(key string) { /* your code */ }"},
        {t:"Create an error wrapping utility with context",c:"package main\\n\\nimport \"fmt\"\\n\\ntype AppError struct {\\n\\tCode    int\\n\\tMessage string\\n\\tCause   error\\n}\\nfunc (e *AppError) Error() string { return fmt.Sprintf(\"%d: %s\", e.Code, e.Message) }\\nfunc (e *AppError) Unwrap() error { return e.Cause }"},
        {t:"Write a file watcher using os/fsnotify patterns",c:"package main\\n\\nfunc watchDir(dir string, onChange func(string)) error {\\n\\t// Watch for file changes\\n\\treturn nil\\n}"},
        {t:"Implement a channel-based fan-out/fan-in pattern",c:"package main\\n\\nfunc fanOut(input <-chan int, workers int) []<-chan int {\\n\\tchannels := make([]<-chan int, workers)\\n\\t// Distribute work\\n\\treturn channels\\n}\\nfunc fanIn(channels ...<-chan int) <-chan int {\\n\\tout := make(chan int)\\n\\t// Merge channels\\n\\treturn out\\n}"},
        {t:"Create a JSON marshaling custom encoder",c:"package main\\n\\nimport \"encoding/json\"\\n\\ntype User struct {\\n\\tName  string `json:\"name\"`\\n\\tEmail string `json:\"email\"`\\n}\\nfunc (u User) MarshalJSON() ([]byte, error) {\\n\\t// Custom serialization\\n\\treturn json.Marshal(struct{ N string }{u.Name})\\n}"},
        {t:"Write a context-based timeout handler",c:"package main\\n\\nimport (\\n\\t\"context\"\\n\\t\"time\"\\n)\\n\\nfunc doWithTimeout(timeout time.Duration, fn func(ctx context.Context) error) error {\\n\\tctx, cancel := context.WithTimeout(context.Background(), timeout)\\n\\tdefer cancel()\\n\\treturn fn(ctx)\\n}"},
        {t:"Implement a ring buffer for streaming data",c:"package main\\n\\ntype RingBuffer struct {\\n\\tbuf  []int\\n\\thead int\\n\\ttail int\\n\\tsize int\\n}\\nfunc (r *RingBuffer) Write(val int) { /* your code */ }\\nfunc (r *RingBuffer) Read() (int, bool) { /* your code */ return 0, false }"},
        {t:"Create a retry function with configurable backoff",c:"package main\\n\\nimport \"time\"\\n\\nfunc retry(attempts int, delay time.Duration, fn func() error) error {\\n\\t// Retry with backoff\\n\\treturn nil\\n}"},
        {t:"Write an interface-based repository pattern",c:"package main\\n\\ntype Entity struct { ID string; Data string }\\ntype Repository interface {\\n\\tFindByID(id string) (*Entity, error)\\n\\tSave(entity *Entity) error\\n\\tDelete(id string) error\\n}"},
        {t:"Implement a simple logger with levels",c:"package main\\n\\nimport \"fmt\"\\n\\ntype LogLevel int\\nconst (\\n\\tDEBUG LogLevel = iota\\n\\tINFO\\n\\tWARN\\n\\tERROR\\n)\\ntype Logger struct { Level LogLevel }\\nfunc (l *Logger) Info(msg string) { if l.Level <= INFO { fmt.Println(msg) } }"},
        {t:"Create a URL shortener using hash encoding",c:"package main\\n\\nimport \"crypto/sha256\"\\n\\nfunc shorten(url string) string {\\n\\th := sha256.Sum256([]byte(url))\\n\\t// Encode first 6 bytes to base62\\n\\treturn \"\"\\n}"},
        {t:"Write a struct validation function using reflection",c:"package main\\n\\nimport \"reflect\"\\n\\nfunc validate(s interface{}) []string {\\n\\terrors := []string{}\\n\\tv := reflect.ValueOf(s)\\n\\t// Check required fields\\n\\t_ = v\\n\\treturn errors\\n}"},
        {t:"Implement a basic linked list in Go",c:"package main\\n\\ntype Node struct { Val int; Next *Node }\\ntype LinkedList struct { Head *Node }\\nfunc (ll *LinkedList) Append(val int) { /* your code */ }\\nfunc (ll *LinkedList) Delete(val int) { /* your code */ }"},
        {t:"Create a semaphore using channels",c:"package main\\n\\ntype Semaphore struct { sem chan struct{} }\\nfunc NewSemaphore(max int) *Semaphore { return &Semaphore{sem: make(chan struct{}, max)} }\\nfunc (s *Semaphore) Acquire() { s.sem <- struct{}{} }\\nfunc (s *Semaphore) Release() { <-s.sem }"},
      ],
      medium: [
        {t:"Implement a token bucket rate limiter",c:"package main\\n\\nimport (\\n\\t\"sync\"\\n\\t\"time\"\\n)\\n\\ntype RateLimiter struct {\\n\\ttokens   float64\\n\\tmax      float64\\n\\trate     float64\\n\\tlastTime time.Time\\n\\tmu       sync.Mutex\\n}\\nfunc (r *RateLimiter) Allow() bool { /* your code */ return false }"},
        {t:"Build a circuit breaker for service calls",c:"package main\\n\\nimport \"time\"\\n\\ntype CircuitBreaker struct {\\n\\tfailures    int\\n\\tthreshold   int\\n\\tstate       string\\n\\tresetAfter  time.Duration\\n\\tlastFailure time.Time\\n}\\nfunc (cb *CircuitBreaker) Call(fn func() error) error { /* your code */ return nil }"},
        {t:"Create a pub-sub message broker with topics",c:"package main\\n\\nimport \"sync\"\\n\\ntype Broker struct {\\n\\tmu   sync.RWMutex\\n\\tsubs map[string][]chan string\\n}\\nfunc (b *Broker) Subscribe(topic string) <-chan string { /* your code */ return nil }\\nfunc (b *Broker) Publish(topic, msg string) { /* your code */ }"},
        {t:"Implement a connection pool for database connections",c:"package main\\n\\nimport \"sync\"\\n\\ntype Conn struct { ID int }\\ntype Pool struct {\\n\\tmu      sync.Mutex\\n\\tconns   []*Conn\\n\\tmaxSize int\\n}\\nfunc (p *Pool) Acquire() *Conn { /* your code */ return nil }\\nfunc (p *Pool) Release(c *Conn) { /* your code */ }"},
        {t:"Build a caching reverse proxy server",c:"package main\\n\\nimport \"net/http\"\\n\\ntype CacheProxy struct {\\n\\tcache   map[string][]byte\\n\\tbackend string\\n}\\nfunc (cp *CacheProxy) ServeHTTP(w http.ResponseWriter, r *http.Request) { /* your code */ }"},
        {t:"Create a distributed ID generator (Snowflake-like)",c:"package main\\n\\nimport (\\n\\t\"sync\"\\n\\t\"time\"\\n)\\n\\ntype IDGenerator struct {\\n\\tmu        sync.Mutex\\n\\tnodeID    int64\\n\\tsequence  int64\\n\\tlastTime  int64\\n}\\nfunc (g *IDGenerator) Generate() int64 { /* your code */ return 0 }"},
        {t:"Implement consistent hashing for load balancing",c:"package main\\n\\nimport (\\n\\t\"hash/crc32\"\\n\\t\"sort\"\\n)\\n\\ntype ConsistentHash struct {\\n\\tring     []uint32\\n\\tnodes    map[uint32]string\\n\\treplicas int\\n}\\nfunc (ch *ConsistentHash) AddNode(node string) { /* your code */ }\\nfunc (ch *ConsistentHash) GetNode(key string) string { /* your code */ return \"\" }"},
        {t:"Build a gRPC-style interceptor chain",c:"package main\\n\\ntype UnaryHandler func(req interface{}) (interface{}, error)\\ntype Interceptor func(req interface{}, handler UnaryHandler) (interface{}, error)\\nfunc chainInterceptors(interceptors ...Interceptor) Interceptor {\\n\\t// Chain all interceptors\\n\\treturn nil\\n}"},
        {t:"Create a write-ahead log for data durability",c:"package main\\n\\nimport \"os\"\\n\\ntype WAL struct {\\n\\tfile *os.File\\n\\tseq  uint64\\n}\\nfunc (w *WAL) Append(data []byte) error { /* your code */ return nil }\\nfunc (w *WAL) Recover() ([][]byte, error) { /* your code */ return nil, nil }"},
        {t:"Implement a generic LRU cache",c:"package main\\n\\ntype entry[K comparable, V any] struct { key K; val V }\\ntype LRUCache[K comparable, V any] struct {\\n\\tcapacity int\\n\\titems    map[K]*entry[K, V]\\n}\\nfunc (c *LRUCache[K, V]) Get(key K) (V, bool) { /* your code */ var z V; return z, false }\\nfunc (c *LRUCache[K, V]) Put(key K, val V) { /* your code */ }"},
        {t:"Build a task scheduler with cron expressions",c:"package main\\n\\nimport \"time\"\\n\\ntype Task struct { Name string; Fn func(); Schedule string }\\ntype Scheduler struct { tasks []Task }\\nfunc (s *Scheduler) Add(name, schedule string, fn func()) { /* your code */ }\\nfunc (s *Scheduler) Start() { /* parse cron and run */ }"},
        {t:"Create a graceful shutdown manager",c:"package main\\n\\nimport (\\n\\t\"context\"\\n\\t\"os/signal\"\\n\\t\"syscall\"\\n)\\n\\ntype ShutdownManager struct { hooks []func(context.Context) error }\\nfunc (sm *ShutdownManager) OnShutdown(fn func(context.Context) error) { sm.hooks = append(sm.hooks, fn) }\\nfunc (sm *ShutdownManager) Wait() { /* listen signals, run hooks */ }"},
        {t:"Implement a Bloom filter for probabilistic membership",c:"package main\\n\\nimport \"hash/fnv\"\\n\\ntype BloomFilter struct {\\n\\tbits  []bool\\n\\thashN int\\n}\\nfunc (bf *BloomFilter) Add(item string) { /* your code */ }\\nfunc (bf *BloomFilter) Contains(item string) bool { /* your code */ return false }"},
        {t:"Build a request-scoped context middleware",c:"package main\\n\\nimport (\\n\\t\"context\"\\n\\t\"net/http\"\\n)\\n\\ntype contextKey string\\nfunc withRequestID(next http.Handler) http.Handler {\\n\\treturn http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {\\n\\t\\tctx := context.WithValue(r.Context(), contextKey(\"requestID\"), generateID())\\n\\t\\tnext.ServeHTTP(w, r.WithContext(ctx))\\n\\t})\\n}\\nfunc generateID() string { return \"\" }"},
        {t:"Create a pipeline pattern for data processing",c:"package main\\n\\ntype Stage func(<-chan interface{}) <-chan interface{}\\nfunc pipeline(source <-chan interface{}, stages ...Stage) <-chan interface{} {\\n\\tout := source\\n\\tfor _, s := range stages {\\n\\t\\tout = s(out)\\n\\t}\\n\\treturn out\\n}"},
        {t:"Implement a binary search tree with iterators",c:"package main\\n\\ntype BSTNode struct { Val int; Left, Right *BSTNode }\\ntype BST struct { Root *BSTNode }\\nfunc (b *BST) Insert(val int) { /* your code */ }\\nfunc (b *BST) InOrder() []int { /* your code */ return nil }\\nfunc (b *BST) Search(val int) bool { /* your code */ return false }"},
        {t:"Build an object pool for reusable resources",c:"package main\\n\\nimport \"sync\"\\n\\ntype ObjectPool[T any] struct {\\n\\tpool sync.Pool\\n}\\nfunc NewPool[T any](factory func() T) *ObjectPool[T] { /* your code */ return nil }\\nfunc (p *ObjectPool[T]) Get() T { /* your code */ var z T; return z }\\nfunc (p *ObjectPool[T]) Put(obj T) { /* your code */ }"},
        {t:"Create a health check aggregator for microservices",c:"package main\\n\\nimport \"net/http\"\\n\\ntype HealthCheck struct { Name string; Check func() error }\\ntype HealthAggregator struct { checks []HealthCheck }\\nfunc (ha *HealthAggregator) Add(hc HealthCheck) { ha.checks = append(ha.checks, hc) }\\nfunc (ha *HealthAggregator) Handler() http.HandlerFunc { /* run all checks */ return nil }"},
        {t:"Implement a bounded concurrent queue",c:"package main\\n\\ntype BoundedQueue[T any] struct {\\n\\tch chan T\\n}\\nfunc NewBoundedQueue[T any](capacity int) *BoundedQueue[T] { return &BoundedQueue[T]{ch: make(chan T, capacity)} }\\nfunc (q *BoundedQueue[T]) Enqueue(item T) bool { /* non-blocking */ return false }\\nfunc (q *BoundedQueue[T]) Dequeue() (T, bool) { /* non-blocking */ var z T; return z, false }"},
        {t:"Build a metrics collector with histograms",c:"package main\\n\\nimport \"sync\"\\n\\ntype Histogram struct {\\n\\tmu      sync.Mutex\\n\\tvalues  []float64\\n\\tbuckets []float64\\n\\tcounts  []int\\n}\\nfunc (h *Histogram) Observe(val float64) { /* your code */ }\\nfunc (h *Histogram) Percentile(p float64) float64 { /* your code */ return 0 }"},
      ],
      hard: [
        {t:"Implement a lock-free concurrent ring buffer",c:"package main\\n\\nimport \"sync/atomic\"\\n\\ntype LFRingBuffer struct {\\n\\tbuf      []int64\\n\\tcapacity int64\\n\\thead     int64\\n\\ttail     int64\\n}\\nfunc (r *LFRingBuffer) Push(val int64) bool { /* CAS-based */ return false }\\nfunc (r *LFRingBuffer) Pop() (int64, bool) { /* CAS-based */ return 0, false }"},
        {t:"Build a Raft consensus implementation",c:"package main\\n\\ntype RaftNode struct {\\n\\tid       int\\n\\tstate    string\\n\\tterm     int\\n\\tlog      []LogEntry\\n\\tpeers    []int\\n}\\ntype LogEntry struct { Term int; Command interface{} }\\nfunc (n *RaftNode) RequestVote(candidateId, term int) bool { /* your code */ return false }\\nfunc (n *RaftNode) AppendEntries(term int, entries []LogEntry) bool { /* your code */ return false }"},
        {t:"Create a custom garbage collector with tri-color marking",c:"package main\\n\\ntype GCObject struct { marked int; refs []*GCObject; data interface{} }\\ntype GC struct { objects []*GCObject; roots []*GCObject }\\nfunc (gc *GC) Mark() { /* tri-color marking */ }\\nfunc (gc *GC) Sweep() { /* free white objects */ }\\nfunc (gc *GC) Collect() { gc.Mark(); gc.Sweep() }"},
        {t:"Implement a B+ tree for database indexing",c:"package main\\n\\nconst order = 4\\ntype BPlusNode struct {\\n\\tkeys     []int\\n\\tchildren []*BPlusNode\\n\\tvalues   []string\\n\\tleaf     bool\\n\\tnext     *BPlusNode\\n}\\ntype BPlusTree struct { root *BPlusNode }\\nfunc (t *BPlusTree) Insert(key int, val string) { /* your code */ }\\nfunc (t *BPlusTree) RangeSearch(lo, hi int) []string { /* your code */ return nil }"},
        {t:"Build a distributed key-value store with replication",c:"package main\\n\\ntype Replica struct { ID int; Store map[string]string }\\ntype DistKV struct {\\n\\treplicas    []*Replica\\n\\treplication  int\\n}\\nfunc (d *DistKV) Put(key, val string) error { /* replicate to N nodes */ return nil }\\nfunc (d *DistKV) Get(key string) (string, error) { /* quorum read */ return \"\", nil }"},
        {t:"Create a TCP connection multiplexer",c:"package main\\n\\nimport \"net\"\\n\\ntype Stream struct { ID uint32; conn net.Conn }\\ntype Muxer struct { conn net.Conn; streams map[uint32]*Stream }\\nfunc (m *Muxer) OpenStream() (*Stream, error) { /* your code */ return nil, nil }\\nfunc (m *Muxer) AcceptStream() (*Stream, error) { /* your code */ return nil, nil }"},
        {t:"Implement a CRDT G-Counter for distributed counting",c:"package main\\n\\ntype GCounter struct {\\n\\tnodeID  int\\n\\tcounts  map[int]int\\n}\\nfunc (g *GCounter) Increment() { g.counts[g.nodeID]++ }\\nfunc (g *GCounter) Value() int { /* sum all */ return 0 }\\nfunc (g *GCounter) Merge(other *GCounter) { /* take max per node */ }"},
        {t:"Build a memory-mapped file database engine",c:"package main\\n\\nimport \"os\"\\n\\ntype MMapDB struct {\\n\\tfile *os.File\\n\\tdata []byte\\n\\tsize int64\\n}\\nfunc (db *MMapDB) Open(path string) error { /* mmap file */ return nil }\\nfunc (db *MMapDB) Read(offset int64, size int) []byte { /* your code */ return nil }\\nfunc (db *MMapDB) Write(offset int64, data []byte) error { /* your code */ return nil }"},
        {t:"Create a work-stealing scheduler for parallel computation",c:"package main\\n\\nimport \"sync\"\\n\\ntype Deque struct { items []func(); mu sync.Mutex }\\ntype WorkStealer struct {\\n\\tworkers []Deque\\n\\tnum     int\\n}\\nfunc (ws *WorkStealer) Submit(task func()) { /* push to local */ }\\nfunc (ws *WorkStealer) Steal(from, to int) { /* steal from tail */ }"},
        {t:"Implement a gossip protocol for cluster membership",c:"package main\\n\\nimport \"time\"\\n\\ntype Member struct { Addr string; Heartbeat int64; Status string }\\ntype GossipNode struct {\\n\\tmembers map[string]*Member\\n\\tself    string\\n}\\nfunc (g *GossipNode) Gossip() { /* pick random peer, exchange state */ }\\nfunc (g *GossipNode) DetectFailures(timeout time.Duration) []string { return nil }"},
        {t:"Build a log-structured merge tree storage engine",c:"package main\\n\\ntype Memtable struct { data map[string]string; size int }\\ntype SSTable struct { path string; index map[string]int64 }\\ntype LSMTree struct {\\n\\tmemtable *Memtable\\n\\tlevels   [][]*SSTable\\n\\tthreshold int\\n}\\nfunc (l *LSMTree) Put(key, val string) error { /* your code */ return nil }\\nfunc (l *LSMTree) Get(key string) (string, error) { /* search memtable then SSTables */ return \"\", nil }\\nfunc (l *LSMTree) Compact() error { /* merge SSTables */ return nil }"},
        {t:"Create a software transactional memory system",c:"package main\\n\\nimport \"sync\"\\n\\ntype TVar struct { val interface{}; version int64; mu sync.Mutex }\\ntype Transaction struct { reads map[*TVar]int64; writes map[*TVar]interface{} }\\nfunc Atomically(fn func(*Transaction)) { /* retry on conflict */ }\\nfunc (tx *Transaction) Read(v *TVar) interface{} { /* your code */ return nil }\\nfunc (tx *Transaction) Write(v *TVar, val interface{}) { /* your code */ }"},
        {t:"Implement a custom network protocol with framing",c:"package main\\n\\nimport (\\n\\t\"encoding/binary\"\\n\\t\"net\"\\n)\\n\\ntype Frame struct { Type uint8; Length uint32; Payload []byte }\\nfunc WriteFrame(conn net.Conn, f Frame) error { /* write header + payload */ return nil }\\nfunc ReadFrame(conn net.Conn) (*Frame, error) { /* read header + payload */ return nil, nil }"},
        {t:"Build a vector clock for distributed event ordering",c:"package main\\n\\ntype VectorClock struct {\\n\\tclocks map[string]int\\n\\tnodeID string\\n}\\nfunc (vc *VectorClock) Tick() { vc.clocks[vc.nodeID]++ }\\nfunc (vc *VectorClock) Merge(other *VectorClock) { /* take max */ }\\nfunc (vc *VectorClock) HappensBefore(other *VectorClock) bool { /* compare */ return false }"},
        {t:"Create a persistent data structure with structural sharing",c:"package main\\n\\ntype PNode struct { val int; children []*PNode; version int }\\ntype PersistentTree struct { root *PNode; versions []*PNode }\\nfunc (pt *PersistentTree) Insert(val int) int { /* return version */ return 0 }\\nfunc (pt *PersistentTree) GetVersion(v int) *PNode { return pt.versions[v] }"},
        {t:"Implement an async I/O event loop using epoll",c:"package main\\n\\nimport \"syscall\"\\n\\ntype EventLoop struct {\\n\\tepfd     int\\n\\thandlers map[int]func(events uint32)\\n}\\nfunc (el *EventLoop) Register(fd int, handler func(uint32)) { /* epoll_ctl */ }\\nfunc (el *EventLoop) Run() { /* epoll_wait loop */ }"},
        {t:"Build a quorum-based distributed consensus",c:"package main\\n\\ntype Proposal struct { ID int; Value string; Votes int }\\ntype QuorumSystem struct {\\n\\tnodes    int\\n\\tquorum   int\\n\\tproposals map[int]*Proposal\\n}\\nfunc (qs *QuorumSystem) Propose(value string) (*Proposal, error) { return nil, nil }\\nfunc (qs *QuorumSystem) Vote(proposalID, nodeID int) bool { return false }"},
        {t:"Create a custom profiler with CPU and memory sampling",c:"package main\\n\\nimport \"runtime\"\\n\\ntype ProfileSample struct { Goroutines int; HeapAlloc uint64; StackTrace string }\\ntype Profiler struct { samples []ProfileSample; interval int }\\nfunc (p *Profiler) Start() { /* periodic sampling */ }\\nfunc (p *Profiler) Stop() []ProfileSample { return p.samples }"},
        {t:"Implement a capability-based security model",c:"package main\\n\\ntype Capability struct { Resource string; Actions []string }\\ntype CapabilityManager struct { caps map[string][]Capability }\\nfunc (cm *CapabilityManager) Grant(principal string, cap Capability) { /* your code */ }\\nfunc (cm *CapabilityManager) Check(principal, resource, action string) bool { return false }"},
        {t:"Build a deterministic simulation testing framework",c:"package main\\n\\nimport \"math/rand\"\\n\\ntype SimNetwork struct { nodes map[int]*SimNode; rng *rand.Rand; partitions map[int]bool }\\ntype SimNode struct { id int; inbox []Message }\\ntype Message struct { From, To int; Data interface{} }\\nfunc (sn *SimNetwork) Send(msg Message) { /* maybe drop/delay */ }\\nfunc (sn *SimNetwork) Step() { /* deliver one message */ }"},
      ]
    },
    "Rust": {
      easy: Array.from({length:20}, (_,i) => ({
        t: ["Implement a safe reference-counted smart pointer","Write an iterator adapter for filtering and mapping","Create a generic HashMap wrapper with default values","Implement the Display trait for a custom struct","Write a function to parse CSV data into structs","Create a builder pattern for configuration","Implement a basic error type with From conversions","Write a generic sorting function with trait bounds","Create a stack using Vec with push/pop/peek","Implement a simple CLI argument parser","Write a function to find duplicates in a vector","Create a newtype wrapper for type safety","Implement the Iterator trait for a custom range","Write string processing utilities with slices","Create a basic file reader with error handling","Implement a queue using VecDeque","Write a function to merge sorted iterators","Create a generic pool allocator","Implement a simple state machine with enums","Write a concurrent counter using Arc and Mutex"][i],
        c: ["pub struct SafeRc<T> {\\n    value: *mut T,\\n    ref_count: *mut usize,\\n}\\nimpl<T> SafeRc<T> {\\n    pub fn new(val: T) -> Self { /* your code */ todo!() }\\n    pub fn clone(&self) -> Self { /* your code */ todo!() }\\n}",
        "pub fn filter_map_iter<T, U>(iter: impl Iterator<Item=T>, pred: impl Fn(&T) -> bool, map: impl Fn(T) -> U) -> Vec<U> {\\n    // Your code here\\n    vec![]\\n}",
        "use std::collections::HashMap;\\npub struct DefaultMap<K, V> {\\n    map: HashMap<K, V>,\\n    default: V,\\n}\\nimpl<K: std::hash::Hash + Eq, V: Clone> DefaultMap<K, V> {\\n    pub fn get(&self, key: &K) -> V { /* your code */ self.default.clone() }\\n}",
        "pub struct Point { pub x: f64, pub y: f64 }\\nimpl std::fmt::Display for Point {\\n    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {\\n        write!(f, \"({}, {})\", self.x, self.y)\\n    }\\n}",
        "pub fn parse_csv(input: &str) -> Vec<Vec<String>> {\\n    // Parse CSV string into rows of fields\\n    vec![]\\n}",
        "pub struct Config { pub host: String, pub port: u16 }\\npub struct ConfigBuilder { host: Option<String>, port: Option<u16> }\\nimpl ConfigBuilder {\\n    pub fn new() -> Self { ConfigBuilder { host: None, port: None } }\\n    pub fn host(mut self, h: &str) -> Self { self.host = Some(h.to_string()); self }\\n    pub fn build(self) -> Config { /* your code */ todo!() }\\n}",
        "use std::fmt;\\n#[derive(Debug)]\\npub enum AppError { NotFound(String), ParseError(String) }\\nimpl fmt::Display for AppError {\\n    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result { write!(f, \"{:?}\", self) }\\n}\\nimpl std::error::Error for AppError {}",
        "pub fn sort_by_key<T, K: Ord>(items: &mut Vec<T>, key_fn: impl Fn(&T) -> K) {\\n    items.sort_by(|a, b| key_fn(a).cmp(&key_fn(b)));\\n}",
        "pub struct Stack<T> { items: Vec<T> }\\nimpl<T> Stack<T> {\\n    pub fn new() -> Self { Stack { items: vec![] } }\\n    pub fn push(&mut self, item: T) { self.items.push(item); }\\n    pub fn pop(&mut self) -> Option<T> { self.items.pop() }\\n    pub fn peek(&self) -> Option<&T> { self.items.last() }\\n}",
        "pub fn parse_args(args: &[String]) -> std::collections::HashMap<String, String> {\\n    // Parse --key=value pairs\\n    std::collections::HashMap::new()\\n}",
        "pub fn find_duplicates<T: Eq + std::hash::Hash + Clone>(items: &[T]) -> Vec<T> {\\n    // Return items that appear more than once\\n    vec![]\\n}",
        "pub struct Meters(pub f64);\\nimpl Meters {\\n    pub fn to_feet(&self) -> f64 { self.0 * 3.28084 }\\n}\\nimpl std::ops::Add for Meters {\\n    type Output = Meters;\\n    fn add(self, other: Meters) -> Meters { Meters(self.0 + other.0) }\\n}",
        "pub struct Range { start: i32, end: i32, current: i32 }\\nimpl Iterator for Range {\\n    type Item = i32;\\n    fn next(&mut self) -> Option<i32> {\\n        if self.current < self.end { let v = self.current; self.current += 1; Some(v) } else { None }\\n    }\\n}",
        "pub fn capitalize_words(s: &str) -> String {\\n    // Capitalize first letter of each word\\n    String::new()\\n}",
        "use std::fs;\\npub fn read_file_lines(path: &str) -> Result<Vec<String>, std::io::Error> {\\n    let content = fs::read_to_string(path)?;\\n    Ok(content.lines().map(String::from).collect())\\n}",
        "use std::collections::VecDeque;\\npub struct Queue<T> { items: VecDeque<T> }\\nimpl<T> Queue<T> {\\n    pub fn new() -> Self { Queue { items: VecDeque::new() } }\\n    pub fn enqueue(&mut self, item: T) { self.items.push_back(item); }\\n    pub fn dequeue(&mut self) -> Option<T> { self.items.pop_front() }\\n}",
        "pub fn merge_sorted(a: &[i32], b: &[i32]) -> Vec<i32> {\\n    // Merge two sorted slices\\n    vec![]\\n}",
        "pub struct PoolAllocator<T> { pool: Vec<T>, free: Vec<usize> }\\nimpl<T> PoolAllocator<T> {\\n    pub fn alloc(&mut self) -> Option<usize> { self.free.pop() }\\n    pub fn free(&mut self, idx: usize) { self.free.push(idx); }\\n}",
        "pub enum State { Idle, Running, Done, Failed }\\nimpl State {\\n    pub fn transition(&self, event: &str) -> State {\\n        match (self, event) {\\n            (State::Idle, \"start\") => State::Running,\\n            (State::Running, \"complete\") => State::Done,\\n            _ => State::Failed,\\n        }\\n    }\\n}",
        "use std::sync::{Arc, Mutex};\\npub fn concurrent_counter() -> Arc<Mutex<i32>> {\\n    let counter = Arc::new(Mutex::new(0));\\n    // Spawn threads to increment\\n    counter\\n}"][i]
      })),
      medium: Array.from({length:20}, (_,i) => ({
        t: ["Implement a thread-safe lock-free concurrent stack","Build an async task executor","Create a trait-based plugin system","Implement a B-tree with insert and search","Write a custom allocator using GlobalAlloc","Build a futures-based stream processor","Create a proc-macro-like attribute parser","Implement a channel-based actor system","Write a connection pool with async/await","Build a serialization framework using traits","Create a lock-free MPSC queue","Implement a skip list data structure","Write a custom async runtime","Build a trie with prefix iteration","Create a type-safe state machine with generics","Implement a work-stealing thread pool","Write a memory-mapped I/O abstraction","Build an event sourcing engine","Create a generic graph with BFS/DFS","Implement a rate limiter with token bucket"][i],
        c: ["use std::sync::atomic::{AtomicPtr, Ordering};\\nstruct Node<T> { val: T, next: *mut Node<T> }\\npub struct ConcurrentStack<T> { head: AtomicPtr<Node<T>> }\\nimpl<T> ConcurrentStack<T> {\\n    pub fn push(&self, val: T) { /* CAS loop */ }\\n    pub fn pop(&self) -> Option<T> { /* CAS loop */ None }\\n}",
        "use std::future::Future;\\nuse std::pin::Pin;\\npub struct Executor { tasks: Vec<Pin<Box<dyn Future<Output=()>>>> }\\nimpl Executor {\\n    pub fn spawn(&mut self, task: impl Future<Output=()> + 'static) { /* your code */ }\\n    pub fn run(&mut self) { /* poll tasks */ }\\n}",
        "pub trait Plugin { fn name(&self) -> &str; fn execute(&self, input: &str) -> String; }\\npub struct PluginManager { plugins: Vec<Box<dyn Plugin>> }\\nimpl PluginManager {\\n    pub fn register(&mut self, plugin: Box<dyn Plugin>) { /* your code */ }\\n    pub fn run_all(&self, input: &str) -> Vec<String> { /* your code */ vec![] }\\n}",
        "pub struct BTreeNode<K: Ord, V> { keys: Vec<K>, values: Vec<V>, children: Vec<Box<BTreeNode<K, V>>>, leaf: bool }\\npub struct BTree<K: Ord, V> { root: Option<Box<BTreeNode<K, V>>>, order: usize }\\nimpl<K: Ord, V> BTree<K, V> {\\n    pub fn insert(&mut self, key: K, val: V) { /* your code */ }\\n    pub fn search(&self, key: &K) -> Option<&V> { /* your code */ None }\\n}",
        "use std::alloc::{GlobalAlloc, Layout};\\npub struct BumpAllocator { heap: *mut u8, offset: usize, size: usize }\\nunsafe impl GlobalAlloc for BumpAllocator {\\n    unsafe fn alloc(&self, layout: Layout) -> *mut u8 { /* your code */ std::ptr::null_mut() }\\n    unsafe fn dealloc(&self, _ptr: *mut u8, _layout: Layout) { /* no-op for bump */ }\\n}",
        "pub trait StreamProcessor<T> { fn process(&mut self, item: T) -> Option<T>; }\\npub struct Pipeline<T> { stages: Vec<Box<dyn StreamProcessor<T>>> }\\nimpl<T> Pipeline<T> {\\n    pub fn add_stage(&mut self, stage: Box<dyn StreamProcessor<T>>) { self.stages.push(stage); }\\n    pub fn execute(&mut self, input: Vec<T>) -> Vec<T> { /* chain stages */ vec![] }\\n}",
        "pub struct Attribute { pub name: String, pub args: Vec<String> }\\npub fn parse_attributes(input: &str) -> Vec<Attribute> {\\n    // Parse #[name(arg1, arg2)] style attributes\\n    vec![]\\n}",
        "use std::sync::mpsc;\\nuse std::thread;\\npub trait Actor: Send + 'static { fn receive(&mut self, msg: String); }\\npub struct ActorRef { sender: mpsc::Sender<String> }\\nimpl ActorRef {\\n    pub fn send(&self, msg: String) { self.sender.send(msg).unwrap(); }\\n}\\npub fn spawn_actor(actor: impl Actor) -> ActorRef { /* your code */ todo!() }",
        "use std::sync::{Arc, Mutex, Condvar};\\npub struct Pool<T> { items: Arc<(Mutex<Vec<T>>, Condvar)>, max: usize }\\nimpl<T> Pool<T> {\\n    pub fn acquire(&self) -> T { /* wait if empty */ todo!() }\\n    pub fn release(&self, item: T) { /* return to pool */ }\\n}",
        "pub trait Serialize { fn serialize(&self) -> Vec<u8>; }\\npub trait Deserialize: Sized { fn deserialize(data: &[u8]) -> Option<Self>; }\\nimpl Serialize for String {\\n    fn serialize(&self) -> Vec<u8> { /* length-prefixed encoding */ vec![] }\\n}",
        "use std::sync::atomic::{AtomicPtr, Ordering};\\npub struct MPSCQueue<T> { head: AtomicPtr<Node<T>>, tail: *mut Node<T> }\\nstruct Node<T> { val: Option<T>, next: AtomicPtr<Node<T>> }\\nimpl<T> MPSCQueue<T> {\\n    pub fn push(&self, val: T) { /* lock-free push */ }\\n    pub fn pop(&mut self) -> Option<T> { /* single consumer pop */ None }\\n}",
        "use rand::Rng;\\npub struct SkipNode<T> { val: T, forward: Vec<Option<Box<SkipNode<T>>>> }\\npub struct SkipList<T: Ord> { head: Box<SkipNode<T>>, max_level: usize }\\nimpl<T: Ord + Default> SkipList<T> {\\n    pub fn insert(&mut self, val: T) { /* random level insert */ }\\n    pub fn search(&self, val: &T) -> bool { /* level-by-level search */ false }\\n}",
        "use std::task::{Context, Poll, Waker};\\npub struct MiniRuntime { wakers: Vec<Waker> }\\nimpl MiniRuntime {\\n    pub fn block_on<F: std::future::Future>(&mut self, fut: F) -> F::Output { /* poll loop */ todo!() }\\n}",
        "pub struct TrieNode { children: std::collections::HashMap<char, TrieNode>, is_end: bool }\\npub struct Trie { root: TrieNode }\\nimpl Trie {\\n    pub fn insert(&mut self, word: &str) { /* your code */ }\\n    pub fn starts_with(&self, prefix: &str) -> Vec<String> { /* collect all words with prefix */ vec![] }\\n}",
        "pub trait State { type Event; type Next; fn transition(self, event: Self::Event) -> Self::Next; }\\npub struct Idle;\\npub struct Running;\\nimpl State for Idle { type Event = (); type Next = Running; fn transition(self, _: ()) -> Running { Running } }",
        "use std::sync::{Arc, Mutex};\\nuse std::collections::VecDeque;\\npub struct WorkStealer { queues: Vec<Arc<Mutex<VecDeque<Box<dyn FnOnce() + Send>>>>> }\\nimpl WorkStealer {\\n    pub fn submit(&self, worker: usize, task: Box<dyn FnOnce() + Send>) { /* push to queue */ }\\n    pub fn steal(&self, from: usize, to: usize) { /* steal from tail */ }\\n}",
        "pub struct MmapFile { data: *mut u8, len: usize }\\nimpl MmapFile {\\n    pub unsafe fn open(path: &str) -> Result<Self, std::io::Error> { /* mmap */ todo!() }\\n    pub fn read(&self, offset: usize, len: usize) -> &[u8] { /* slice into mmap */ &[] }\\n}",
        "pub trait Event: Clone { fn event_type(&self) -> &str; }\\npub struct EventStore<E: Event> { events: Vec<E> }\\nimpl<E: Event> EventStore<E> {\\n    pub fn append(&mut self, event: E) { self.events.push(event); }\\n    pub fn replay(&self) -> &[E] { &self.events }\\n}",
        "use std::collections::{HashMap, VecDeque};\\npub struct Graph<T> { adj: HashMap<T, Vec<T>> }\\nimpl<T: Eq + std::hash::Hash + Clone> Graph<T> {\\n    pub fn bfs(&self, start: &T) -> Vec<T> { /* your code */ vec![] }\\n    pub fn dfs(&self, start: &T) -> Vec<T> { /* your code */ vec![] }\\n}",
        "use std::time::Instant;\\npub struct TokenBucket { tokens: f64, capacity: f64, rate: f64, last: Instant }\\nimpl TokenBucket {\\n    pub fn allow(&mut self) -> bool { /* refill and check */ false }\\n}"][i]
      })),
      hard: Array.from({length:20}, (_,i) => ({
        t: ["Create a zero-copy binary frame parser","Implement a custom async runtime with io_uring","Build a CRDT-based replicated data store","Create a JIT compiler for a simple expression language","Implement a lock-free concurrent hash map","Build a kernel module interface using FFI","Create a memory-safe arena allocator","Implement a Raft log replication module","Build a custom TCP stack in user space","Create a deterministic concurrency testing framework","Implement a persistent B+ tree on disk","Build a WebAssembly interpreter","Create a software transactional memory library","Implement a copy-on-write filesystem layer","Build a distributed actor framework","Create a type-erased heterogeneous container","Implement a compile-time state machine validator","Build a zero-overhead serialization framework","Create a lock-free work-stealing deque","Implement an ECS (Entity Component System) framework"][i],
        c: ["// Zero-copy parser for binary frames\\npub struct Frame<'a> { pub header: &'a [u8], pub payload: &'a [u8] }\\npub fn parse_frame(data: &[u8]) -> Option<Frame> {\\n    // Parse without copying\\n    None\\n}",
        "// Custom async runtime\\nuse std::future::Future;\\npub struct Runtime { /* io_uring fd, task queue */ }\\nimpl Runtime {\\n    pub fn new() -> Self { todo!() }\\n    pub fn block_on<F: Future>(&self, fut: F) -> F::Output { todo!() }\\n    pub fn spawn<F: Future + Send + 'static>(&self, fut: F) { /* submit to ring */ }\\n}",
        "// CRDT replicated store\\npub enum CrdtValue { GCounter(Vec<u64>), LWWRegister { value: String, timestamp: u64 } }\\npub struct CrdtStore { node_id: usize, data: std::collections::HashMap<String, CrdtValue> }\\nimpl CrdtStore {\\n    pub fn merge(&mut self, other: &CrdtStore) { /* merge by CRDT rules */ }\\n}",
        "// JIT compiler\\npub enum Expr { Num(f64), Add(Box<Expr>, Box<Expr>), Mul(Box<Expr>, Box<Expr>) }\\npub struct JIT { code: Vec<u8> }\\nimpl JIT {\\n    pub fn compile(&mut self, expr: &Expr) { /* emit x86 instructions */ }\\n    pub unsafe fn execute(&self) -> f64 { /* call compiled code */ 0.0 }\\n}",
        "use std::sync::atomic::{AtomicPtr, AtomicUsize, Ordering};\\npub struct ConcurrentHashMap<K, V> {\\n    buckets: Vec<AtomicPtr<Entry<K, V>>>,\\n    size: AtomicUsize,\\n}\\nstruct Entry<K, V> { key: K, value: V, next: AtomicPtr<Entry<K, V>> }\\nimpl<K: Eq + std::hash::Hash, V> ConcurrentHashMap<K, V> {\\n    pub fn get(&self, key: &K) -> Option<&V> { None }\\n    pub fn insert(&self, key: K, value: V) { /* lock-free bucket insert */ }\\n}",
        "// FFI kernel module interface\\n#[repr(C)]\\npub struct KernelModule { name: [u8; 64], init: extern \"C\" fn() -> i32, exit: extern \"C\" fn() }\\npub unsafe fn load_module(path: &str) -> Result<KernelModule, String> { /* dlopen + resolve symbols */ Err(String::new()) }",
        "// Arena allocator with lifetimes\\npub struct Arena { data: Vec<u8>, offset: usize }\\nimpl Arena {\\n    pub fn new(capacity: usize) -> Self { Arena { data: vec![0; capacity], offset: 0 } }\\n    pub fn alloc<T>(&mut self, val: T) -> &mut T { /* bump allocate */ todo!() }\\n    pub fn reset(&mut self) { self.offset = 0; }\\n}",
        "// Raft replication\\npub struct LogEntry { term: u64, index: u64, command: Vec<u8> }\\npub struct RaftLog { entries: Vec<LogEntry>, commit_index: u64 }\\nimpl RaftLog {\\n    pub fn append(&mut self, entry: LogEntry) { /* your code */ }\\n    pub fn replicate_to(&self, follower_next: u64) -> &[LogEntry] { /* entries to send */ &[] }\\n    pub fn commit_up_to(&mut self, index: u64) { /* advance commit */ }\\n}",
        "// User-space TCP\\npub struct TcpState { seq: u32, ack: u32, state: u8, window: u16 }\\nimpl TcpState {\\n    pub fn send_syn(&mut self) -> Vec<u8> { /* craft SYN packet */ vec![] }\\n    pub fn handle_packet(&mut self, packet: &[u8]) -> Option<Vec<u8>> { /* state machine */ None }\\n}",
        "// Deterministic testing\\nuse std::collections::BinaryHeap;\\npub struct DetScheduler { events: BinaryHeap<(u64, usize)>, rng_seed: u64 }\\nimpl DetScheduler {\\n    pub fn schedule(&mut self, thread: usize, time: u64) { /* your code */ }\\n    pub fn next(&mut self) -> Option<usize> { /* deterministic pick */ None }\\n}",
        "// Persistent B+ tree\\nuse std::fs::File;\\npub struct DiskBPlusTree { file: File, root_offset: u64, page_size: usize }\\nimpl DiskBPlusTree {\\n    pub fn insert(&mut self, key: i64, value: &[u8]) -> std::io::Result<()> { /* write pages */ Ok(()) }\\n    pub fn get(&self, key: i64) -> std::io::Result<Option<Vec<u8>>> { /* read pages */ Ok(None) }\\n}",
        "// WASM interpreter\\npub enum WasmInstr { I32Const(i32), I32Add, I32Mul, LocalGet(u32), Call(u32) }\\npub struct WasmVM { stack: Vec<i32>, locals: Vec<i32> }\\nimpl WasmVM {\\n    pub fn execute(&mut self, instrs: &[WasmInstr]) -> i32 { /* interpret */ 0 }\\n}",
        "// Software transactional memory\\nuse std::sync::{Arc, Mutex};\\npub struct TVar<T> { value: Arc<Mutex<(T, u64)>> }\\npub struct Transaction { reads: Vec<(usize, u64)>, writes: Vec<(usize, Box<dyn std::any::Any>)> }\\nimpl Transaction {\\n    pub fn read<T: Clone + 'static>(&mut self, var: &TVar<T>) -> T { /* your code */ todo!() }\\n    pub fn write<T: 'static>(&mut self, var: &TVar<T>, val: T) { /* buffer write */ }\\n    pub fn commit(&self) -> bool { /* validate and apply */ false }\\n}",
        "// Copy-on-write FS layer\\npub struct CowBlock { data: Vec<u8>, ref_count: usize }\\npub struct CowFS { blocks: Vec<CowBlock> }\\nimpl CowFS {\\n    pub fn read(&self, block_id: usize) -> &[u8] { &self.blocks[block_id].data }\\n    pub fn write(&mut self, block_id: usize, data: Vec<u8>) -> usize { /* CoW: copy then write */ 0 }\\n    pub fn snapshot(&mut self) -> Vec<usize> { /* increment ref counts */ vec![] }\\n}",
        "// Distributed actors\\nuse std::sync::mpsc;\\npub struct RemoteActorRef { addr: String, sender: mpsc::Sender<Vec<u8>> }\\npub trait DistributedActor: Send + 'static {\\n    fn receive(&mut self, msg: Vec<u8>) -> Vec<u8>;\\n    fn node_id(&self) -> &str;\\n}\\npub struct ActorCluster { actors: Vec<Box<dyn DistributedActor>> }",
        "// Type-erased container\\nuse std::any::{Any, TypeId};\\npub struct AnyMap { map: std::collections::HashMap<TypeId, Box<dyn Any>> }\\nimpl AnyMap {\\n    pub fn insert<T: 'static>(&mut self, val: T) { self.map.insert(TypeId::of::<T>(), Box::new(val)); }\\n    pub fn get<T: 'static>(&self) -> Option<&T> { self.map.get(&TypeId::of::<T>())?.downcast_ref() }\\n}",
        "// Compile-time state validation\\npub struct Locked;\\npub struct Unlocked;\\npub struct Door<State> { _state: std::marker::PhantomData<State> }\\nimpl Door<Unlocked> { pub fn lock(self) -> Door<Locked> { Door { _state: std::marker::PhantomData } } }\\nimpl Door<Locked> { pub fn unlock(self) -> Door<Unlocked> { Door { _state: std::marker::PhantomData } } }",
        "// Zero-overhead serialization\\npub unsafe trait ZeroCopy: Sized {\\n    fn as_bytes(&self) -> &[u8] {\\n        unsafe { std::slice::from_raw_parts(self as *const Self as *const u8, std::mem::size_of::<Self>()) }\\n    }\\n    fn from_bytes(data: &[u8]) -> Option<&Self> {\\n        if data.len() >= std::mem::size_of::<Self>() {\\n            Some(unsafe { &*(data.as_ptr() as *const Self) })\\n        } else { None }\\n    }\\n}",
        "// Lock-free work-stealing deque\\nuse std::sync::atomic::{AtomicIsize, Ordering};\\npub struct WSDeque<T> { buffer: Vec<Option<T>>, top: AtomicIsize, bottom: AtomicIsize }\\nimpl<T> WSDeque<T> {\\n    pub fn push(&mut self, val: T) { /* owner pushes to bottom */ }\\n    pub fn pop(&mut self) -> Option<T> { /* owner pops from bottom */ None }\\n    pub fn steal(&self) -> Option<T> { /* thief steals from top */ None }\\n}",
        "// ECS framework\\nuse std::any::{Any, TypeId};\\npub type Entity = usize;\\npub struct World {\\n    next_id: Entity,\\n    components: std::collections::HashMap<TypeId, Vec<Option<Box<dyn Any>>>>,\\n}\\nimpl World {\\n    pub fn spawn(&mut self) -> Entity { let id = self.next_id; self.next_id += 1; id }\\n    pub fn add_component<T: 'static>(&mut self, entity: Entity, comp: T) { /* your code */ }\\n    pub fn query<T: 'static>(&self) -> Vec<(Entity, &T)> { /* your code */ vec![] }\\n}"][i]
      }))
    },
  };

  // For the remaining skills not in the detailed map, create them from shorter arrays
  const shortSkills = ["C++", "Docker", "Kubernetes", "AWS", "React", "Node.js", "HTML5 & CSS3"];
  
  if (defs[skill]) return defs[skill];

  // Generate remaining skills programmatically from topic lists
  return generateFromTopics(skill);
}

function generateFromTopics(skill) {
  const topicMap = {
    "C++": {
      easy: makeCppProblems('easy'),
      medium: makeCppProblems('medium'),
      hard: makeCppProblems('hard')
    },
    "Docker": {
      easy: makeDockerProblems('easy'),
      medium: makeDockerProblems('medium'),
      hard: makeDockerProblems('hard')
    },
    "Kubernetes": {
      easy: makeK8sProblems('easy'),
      medium: makeK8sProblems('medium'),
      hard: makeK8sProblems('hard')
    },
    "AWS": {
      easy: makeAWSProblems('easy'),
      medium: makeAWSProblems('medium'),
      hard: makeAWSProblems('hard')
    },
    "React": {
      easy: makeReactProblems('easy'),
      medium: makeReactProblems('medium'),
      hard: makeReactProblems('hard')
    },
    "Node.js": {
      easy: makeNodeProblems('easy'),
      medium: makeNodeProblems('medium'),
      hard: makeNodeProblems('hard')
    },
    "HTML5 & CSS3": {
      easy: makeHTMLProblems('easy'),
      medium: makeHTMLProblems('medium'),
      hard: makeHTMLProblems('hard')
    }
  };
  return topicMap[skill] || { easy: [], medium: [], hard: [] };
}

function makeCppProblems(diff) {
  const e = [
    {t:"Create a template-based unique smart pointer",c:"template<typename T>\\nclass UniquePtr {\\nprivate:\\n    T* ptr;\\npublic:\\n    explicit UniquePtr(T* p = nullptr) : ptr(p) {}\\n    ~UniquePtr() { delete ptr; }\\n    T& operator*() { return *ptr; }\\n    T* operator->() { return ptr; }\\n};"},
    {t:"Implement a generic stack using templates",c:"template<typename T>\\nclass Stack {\\n    T* data; int top_idx; int cap;\\npublic:\\n    Stack(int c) : cap(c), top_idx(-1) { data = new T[c]; }\\n    void push(T val) { data[++top_idx] = val; }\\n    T pop() { return data[top_idx--]; }\\n    ~Stack() { delete[] data; }\\n};"},
    {t:"Write a RAII file handle wrapper",c:"#include <fstream>\\nclass FileHandle {\\n    std::fstream file;\\npublic:\\n    FileHandle(const std::string& path) { file.open(path); }\\n    ~FileHandle() { if(file.is_open()) file.close(); }\\n    std::fstream& get() { return file; }\\n};"},
    {t:"Create a simple string class with move semantics",c:"class String {\\n    char* data; size_t len;\\npublic:\\n    String(const char* s);\\n    String(String&& other) noexcept;\\n    String& operator=(String&& other) noexcept;\\n    ~String() { delete[] data; }\\n};"},
    {t:"Implement an iterator for a custom container",c:"template<typename T>\\nclass Array {\\n    T* data; size_t sz;\\npublic:\\n    class Iterator {\\n        T* ptr;\\n    public:\\n        Iterator(T* p) : ptr(p) {}\\n        T& operator*() { return *ptr; }\\n        Iterator& operator++() { ++ptr; return *this; }\\n        bool operator!=(const Iterator& o) { return ptr != o.ptr; }\\n    };\\n    Iterator begin() { return Iterator(data); }\\n    Iterator end() { return Iterator(data + sz); }\\n};"},
    {t:"Write a template function for finding min/max",c:"template<typename T>\\nstd::pair<T,T> minmax(const std::vector<T>& v) {\\n    T mn = v[0], mx = v[0];\\n    for(const auto& x : v) { mn = std::min(mn, x); mx = std::max(mx, x); }\\n    return {mn, mx};\\n}"},
    {t:"Create a shared pointer with reference counting",c:"template<typename T>\\nclass SharedPtr {\\n    T* ptr; int* count;\\npublic:\\n    SharedPtr(T* p) : ptr(p), count(new int(1)) {}\\n    SharedPtr(const SharedPtr& o) : ptr(o.ptr), count(o.count) { ++(*count); }\\n    ~SharedPtr() { if(--(*count) == 0) { delete ptr; delete count; } }\\n};"},
    {t:"Implement operator overloading for a Vector2D class",c:"class Vector2D {\\npublic:\\n    double x, y;\\n    Vector2D(double x, double y) : x(x), y(y) {}\\n    Vector2D operator+(const Vector2D& o) const { return {x+o.x, y+o.y}; }\\n    Vector2D operator*(double s) const { return {x*s, y*s}; }\\n    double dot(const Vector2D& o) const { return x*o.x + y*o.y; }\\n};"},
    {t:"Write a variadic template print function",c:"#include <iostream>\\ntemplate<typename T>\\nvoid print(T val) { std::cout << val << std::endl; }\\ntemplate<typename T, typename... Args>\\nvoid print(T first, Args... rest) { std::cout << first << \" \"; print(rest...); }"},
    {t:"Create a lambda-based callback system",c:"#include <functional>\\n#include <vector>\\nclass CallbackManager {\\n    std::vector<std::function<void()>> callbacks;\\npublic:\\n    void add(std::function<void()> cb) { callbacks.push_back(cb); }\\n    void fireAll() { for(auto& cb : callbacks) cb(); }\\n};"},
    {t:"Implement a basic hash map with separate chaining",c:"#include <vector>\\n#include <list>\\ntemplate<typename K, typename V>\\nclass HashMap {\\n    std::vector<std::list<std::pair<K,V>>> buckets;\\n    size_t sz;\\npublic:\\n    HashMap(size_t n) : buckets(n), sz(0) {}\\n    void put(K key, V val) { /* your code */ }\\n    V* get(K key) { /* your code */ return nullptr; }\\n};"},
    {t:"Write a constexpr factorial computation",c:"constexpr int factorial(int n) {\\n    return n <= 1 ? 1 : n * factorial(n-1);\\n}\\nstatic_assert(factorial(5) == 120);"},
    {t:"Create an enum class with string conversion",c:"#include <string>\\nenum class Color { Red, Green, Blue };\\nstd::string to_string(Color c) {\\n    switch(c) {\\n        case Color::Red: return \"Red\";\\n        case Color::Green: return \"Green\";\\n        case Color::Blue: return \"Blue\";\\n    }\\n    return \"Unknown\";\\n}"},
    {t:"Implement a simple thread-safe singleton",c:"#include <mutex>\\nclass Singleton {\\n    static Singleton* instance;\\n    static std::mutex mtx;\\n    Singleton() {}\\npublic:\\n    static Singleton* getInstance() {\\n        std::lock_guard<std::mutex> lock(mtx);\\n        if(!instance) instance = new Singleton();\\n        return instance;\\n    }\\n};"},
    {t:"Write a range-based for loop compatible container",c:"template<typename T>\\nclass Range {\\n    T start_, end_;\\npublic:\\n    Range(T s, T e) : start_(s), end_(e) {}\\n    struct Iterator {\\n        T val;\\n        T operator*() { return val; }\\n        Iterator& operator++() { ++val; return *this; }\\n        bool operator!=(const Iterator& o) { return val != o.val; }\\n    };\\n    Iterator begin() { return {start_}; }\\n    Iterator end() { return {end_}; }\\n};"},
    {t:"Create an optional type wrapper",c:"template<typename T>\\nclass Optional {\\n    alignas(T) char storage[sizeof(T)];\\n    bool has_val = false;\\npublic:\\n    Optional() = default;\\n    Optional(T val) : has_val(true) { new(storage) T(std::move(val)); }\\n    bool has_value() const { return has_val; }\\n    T& value() { return *reinterpret_cast<T*>(storage); }\\n};"},
    {t:"Implement a circular buffer with iterators",c:"template<typename T, size_t N>\\nclass CircularBuffer {\\n    T data[N]; size_t head=0, tail=0, count=0;\\npublic:\\n    void push(T val) { data[tail] = val; tail = (tail+1)%N; if(count<N) count++; else head=(head+1)%N; }\\n    T front() { return data[head]; }\\n    size_t size() { return count; }\\n};"},
    {t:"Write a type traits checker for numeric types",c:"#include <type_traits>\\ntemplate<typename T>\\nstruct is_numeric : std::integral_constant<bool,\\n    std::is_integral<T>::value || std::is_floating_point<T>::value> {};\\nstatic_assert(is_numeric<int>::value);\\nstatic_assert(!is_numeric<std::string>::value);"},
    {t:"Create a CRTP-based mixin for comparison operators",c:"template<typename Derived>\\nclass Comparable {\\npublic:\\n    bool operator!=(const Derived& o) const { return !(static_cast<const Derived&>(*this) == o); }\\n    bool operator>(const Derived& o) const { return o < static_cast<const Derived&>(*this); }\\n    bool operator<=(const Derived& o) const { return !(static_cast<const Derived&>(*this) > o); }\\n};"},
    {t:"Implement a simple memory arena allocator",c:"class Arena {\\n    char* memory; size_t offset; size_t capacity;\\npublic:\\n    Arena(size_t cap) : capacity(cap), offset(0) { memory = new char[cap]; }\\n    void* alloc(size_t size) { void* p = memory+offset; offset+=size; return p; }\\n    void reset() { offset = 0; }\\n    ~Arena() { delete[] memory; }\\n};"},
  ];
  const m = [
    {t:"Design a compile-time type trait checker template",c:"template<typename T>\\nstruct is_pointer { static const bool value = false; };\\ntemplate<typename T>\\nstruct is_pointer<T*> { static const bool value = true; };\\nstatic_assert(is_pointer<int*>::value);\\nstatic_assert(!is_pointer<int>::value);"},
    {t:"Implement a thread pool with task queue",c:"#include <thread>\\n#include <queue>\\n#include <mutex>\\n#include <condition_variable>\\n#include <functional>\\nclass ThreadPool {\\n    std::vector<std::thread> workers;\\n    std::queue<std::function<void()>> tasks;\\n    std::mutex mtx; std::condition_variable cv; bool stop=false;\\npublic:\\n    ThreadPool(size_t n);\\n    void enqueue(std::function<void()> task);\\n    ~ThreadPool();\\n};"},
    {t:"Create a compile-time string hashing function",c:"constexpr uint32_t fnv1a(const char* s, uint32_t h = 2166136261u) {\\n    return *s ? fnv1a(s+1, (h ^ *s) * 16777619u) : h;\\n}\\nstatic_assert(fnv1a(\"hello\") != fnv1a(\"world\"));"},
    {t:"Build an expression template for lazy evaluation",c:"template<typename L, typename R>\\nstruct AddExpr {\\n    L left; R right;\\n    auto operator[](int i) const { return left[i] + right[i]; }\\n};\\ntemplate<typename L, typename R>\\nAddExpr<L,R> operator+(const L& l, const R& r) { return {l, r}; }"},
    {t:"Implement a lock-free stack using atomics",c:"#include <atomic>\\ntemplate<typename T>\\nclass LockFreeStack {\\n    struct Node { T data; Node* next; };\\n    std::atomic<Node*> head{nullptr};\\npublic:\\n    void push(T val) { auto n=new Node{val,nullptr}; n->next=head.load(); while(!head.compare_exchange_weak(n->next,n)); }\\n    bool pop(T& val) { auto n=head.load(); while(n && !head.compare_exchange_weak(n,n->next)); if(n){val=n->data; delete n; return true;} return false; }\\n};"},
    {t:"Create a SFINAE-based function overload selector",c:"#include <type_traits>\\ntemplate<typename T, typename = std::enable_if_t<std::is_integral_v<T>>>\\nvoid process(T val) { /* integer version */ }\\ntemplate<typename T, typename = std::enable_if_t<std::is_floating_point_v<T>>, typename = void>\\nvoid process(T val) { /* float version */ }"},
    {t:"Implement a coroutine-based generator",c:"#include <coroutine>\\ntemplate<typename T>\\nstruct Generator {\\n    struct promise_type {\\n        T value;\\n        Generator get_return_object() { return Generator{std::coroutine_handle<promise_type>::from_promise(*this)}; }\\n        std::suspend_always initial_suspend() { return {}; }\\n        std::suspend_always final_suspend() noexcept { return {}; }\\n        std::suspend_always yield_value(T v) { value=v; return {}; }\\n        void return_void() {}\\n        void unhandled_exception() {}\\n    };\\n    std::coroutine_handle<promise_type> handle;\\n};"},
    {t:"Build a policy-based design pattern",c:"struct LogToConsole { void log(const std::string& msg) { std::cout << msg; } };\\nstruct LogToFile { void log(const std::string& msg) { /* write to file */ } };\\ntemplate<typename LogPolicy>\\nclass Service : public LogPolicy {\\npublic:\\n    void doWork() { this->log(\"Working...\"); }\\n};"},
    {t:"Create a custom allocator for STL containers",c:"template<typename T>\\nclass PoolAllocator {\\npublic:\\n    using value_type = T;\\n    T* allocate(size_t n) { return static_cast<T*>(::operator new(n * sizeof(T))); }\\n    void deallocate(T* p, size_t) { ::operator delete(p); }\\n};\\nstd::vector<int, PoolAllocator<int>> vec;"},
    {t:"Implement a visitor pattern with std::variant",c:"#include <variant>\\nstruct Circle { double radius; };\\nstruct Rect { double w, h; };\\nusing Shape = std::variant<Circle, Rect>;\\ndouble area(const Shape& s) {\\n    return std::visit([](const auto& shape) -> double {\\n        if constexpr(std::is_same_v<std::decay_t<decltype(shape)>, Circle>) return 3.14159 * shape.radius * shape.radius;\\n        else return shape.w * shape.h;\\n    }, s);\\n}"},
    {t:"Write a concept-constrained generic algorithm",c:"#include <concepts>\\ntemplate<typename T>\\nconcept Sortable = requires(T a, T b) { { a < b } -> std::convertible_to<bool>; };\\ntemplate<Sortable T>\\nvoid quicksort(std::vector<T>& arr, int lo, int hi) { /* your code */ }"},
    {t:"Create a signal-slot event system",c:"#include <functional>\\n#include <vector>\\ntemplate<typename... Args>\\nclass Signal {\\n    std::vector<std::function<void(Args...)>> slots;\\npublic:\\n    void connect(std::function<void(Args...)> slot) { slots.push_back(slot); }\\n    void emit(Args... args) { for(auto& s : slots) s(args...); }\\n};"},
    {t:"Implement a memory-mapped file reader",c:"#ifdef _WIN32\\n#include <windows.h>\\n#else\\n#include <sys/mman.h>\\n#endif\\nclass MappedFile {\\n    void* data; size_t size;\\npublic:\\n    bool open(const char* path);\\n    const char* get() const { return static_cast<const char*>(data); }\\n    size_t length() const { return size; }\\n    ~MappedFile();\\n};"},
    {t:"Build a compile-time finite state machine",c:"template<int State>\\nstruct FSM {\\n    template<int Event>\\n    static constexpr int transition();\\n};\\ntemplate<> template<>\\nconstexpr int FSM<0>::transition<1>() { return 1; }\\ntemplate<> template<>\\nconstexpr int FSM<1>::transition<2>() { return 2; }"},
    {t:"Create a double-dispatch mechanism",c:"class Shape; class Circle; class Rect;\\nclass Visitor {\\npublic:\\n    virtual void visit(Circle&) = 0;\\n    virtual void visit(Rect&) = 0;\\n};\\nclass Shape { public: virtual void accept(Visitor&) = 0; };\\nclass Circle : public Shape { public: void accept(Visitor& v) override { v.visit(*this); } };"},
    {t:"Implement a type-safe unit conversion system",c:"template<int M, int KG, int S>\\nstruct Unit { double value; };\\nusing Meters = Unit<1,0,0>;\\nusing Seconds = Unit<0,0,1>;\\nusing MPS = Unit<1,0,-1>;\\ntemplate<int M1,int K1,int S1,int M2,int K2,int S2>\\nUnit<M1-M2,K1-K2,S1-S2> operator/(Unit<M1,K1,S1> a, Unit<M2,K2,S2> b) { return {a.value/b.value}; }"},
    {t:"Write a reflection-like property system",c:"#include <string>\\n#include <map>\\n#include <any>\\nclass Reflectable {\\n    std::map<std::string, std::any> props;\\npublic:\\n    template<typename T> void set(const std::string& name, T val) { props[name] = val; }\\n    template<typename T> T get(const std::string& name) { return std::any_cast<T>(props[name]); }\\n};"},
    {t:"Create an async task with std::future and std::async",c:"#include <future>\\n#include <vector>\\nclass TaskRunner {\\n    std::vector<std::future<int>> futures;\\npublic:\\n    void submit(std::function<int()> fn) { futures.push_back(std::async(std::launch::async, fn)); }\\n    std::vector<int> collectAll() { std::vector<int> r; for(auto& f:futures) r.push_back(f.get()); return r; }\\n};"},
    {t:"Implement a small buffer optimization string",c:"class SBOString {\\n    static constexpr size_t BUF_SIZE = 16;\\n    union { char buf[BUF_SIZE]; char* heap; };\\n    size_t len; bool on_heap;\\npublic:\\n    SBOString(const char* s);\\n    const char* c_str() const { return on_heap ? heap : buf; }\\n    ~SBOString() { if(on_heap) delete[] heap; }\\n};"},
    {t:"Build a generic observer pattern with templates",c:"template<typename... Args>\\nclass Observable {\\n    std::vector<std::function<void(Args...)>> observers;\\npublic:\\n    void subscribe(std::function<void(Args...)> fn) { observers.push_back(fn); }\\n    void notify(Args... args) { for(auto& o : observers) o(args...); }\\n};"},
  ];
  const h = [
    {t:"Create a lock-free concurrent priority queue",c:"#include <atomic>\\ntemplate<typename T>\\nclass LFPriorityQueue {\\n    // Skip-list based lock-free priority queue\\n    struct Node { T data; int level; std::atomic<Node*> next[1]; };\\n    std::atomic<Node*> head;\\npublic:\\n    void insert(T val) { /* lock-free insert with CAS */ }\\n    bool try_remove_min(T& out) { /* lock-free remove */ return false; }\\n};"},
    {t:"Implement a custom memory allocator with coalescing",c:"class BuddyAllocator {\\n    char* memory; size_t total;\\n    struct Block { size_t size; bool free; Block* next; };\\n    Block* free_list;\\npublic:\\n    BuddyAllocator(size_t size);\\n    void* alloc(size_t size);\\n    void free(void* ptr);\\n    void coalesce();\\n};"},
    {t:"Build a compile-time regular expression matcher",c:"template<char... Pattern>\\nstruct Regex {\\n    static constexpr bool match(const char* text) {\\n        // Compile-time pattern matching\\n        return false;\\n    }\\n};"},
    {t:"Create a SIMD-optimized matrix multiplication",c:"#include <immintrin.h>\\nvoid mat_mul_avx(float* a, float* b, float* c, int n) {\\n    for(int i=0; i<n; i++)\\n        for(int j=0; j<n; j+=8) {\\n            __m256 sum = _mm256_setzero_ps();\\n            for(int k=0; k<n; k++)\\n                sum = _mm256_fmadd_ps(_mm256_set1_ps(a[i*n+k]), _mm256_loadu_ps(&b[k*n+j]), sum);\\n            _mm256_storeu_ps(&c[i*n+j], sum);\\n        }\\n}"},
    {t:"Implement a coroutine-based async framework",c:"#include <coroutine>\\nstruct Task {\\n    struct promise_type {\\n        Task get_return_object() { return {}; }\\n        std::suspend_never initial_suspend() { return {}; }\\n        std::suspend_never final_suspend() noexcept { return {}; }\\n        void return_void() {}\\n        void unhandled_exception() {}\\n    };\\n};\\n// Implement awaitable I/O operations"},
    {t:"Build a JIT compiler for arithmetic expressions",c:"#include <vector>\\nclass JIT {\\n    std::vector<uint8_t> code;\\npublic:\\n    void emit_mov_rax(int64_t val);\\n    void emit_add_rax(int64_t val);\\n    void emit_ret();\\n    int64_t execute();\\n};"},
    {t:"Create a concurrent skip list with fine-grained locking",c:"#include <mutex>\\n#include <vector>\\ntemplate<typename K, typename V>\\nclass ConcurrentSkipList {\\n    struct Node { K key; V val; std::vector<std::atomic<Node*>> next; std::mutex lock; };\\n    Node* head; int max_level;\\npublic:\\n    void insert(K key, V val);\\n    V* find(K key);\\n    bool remove(K key);\\n};"},
    {t:"Implement a wait-free SPSC queue",c:"#include <atomic>\\ntemplate<typename T, size_t N>\\nclass SPSCQueue {\\n    T buffer[N];\\n    std::atomic<size_t> head{0}, tail{0};\\npublic:\\n    bool push(const T& val) { /* wait-free */ return false; }\\n    bool pop(T& val) { /* wait-free */ return false; }\\n};"},
    {t:"Build a custom ECS (Entity Component System) engine",c:"#include <unordered_map>\\n#include <typeindex>\\n#include <any>\\nusing Entity = uint32_t;\\nclass ECS {\\n    std::unordered_map<std::type_index, std::unordered_map<Entity, std::any>> stores;\\npublic:\\n    Entity create();\\n    template<typename T> void add(Entity e, T comp);\\n    template<typename T> T* get(Entity e);\\n    template<typename... Ts> std::vector<Entity> query();\\n};"},
    {t:"Create a fiber-based cooperative multitasking system",c:"#include <ucontext.h>\\nclass Fiber {\\n    ucontext_t ctx;\\n    char stack[8192];\\n    bool finished;\\npublic:\\n    Fiber(void (*fn)(void));\\n    void resume();\\n    static void yield();\\n};\\nclass FiberScheduler {\\n    std::vector<Fiber*> fibers;\\npublic:\\n    void spawn(void (*fn)(void));\\n    void run();\\n};"},
    {t:"Implement a B+ tree with disk persistence",c:"struct BPlusPage { int keys[255]; int children[256]; int n; bool leaf; int64_t offset; };\\nclass BPlusTree {\\n    FILE* file; int64_t root_offset;\\npublic:\\n    void insert(int key, int value);\\n    int* search(int key);\\n    std::vector<int> range_query(int lo, int hi);\\n};"},
    {t:"Build a software rasterizer",c:"struct Vec3 { float x,y,z; };\\nstruct Triangle { Vec3 v[3]; };\\nclass Rasterizer {\\n    uint32_t* framebuffer; float* zbuffer; int w, h;\\npublic:\\n    void draw_triangle(Triangle& tri);\\n    void clear();\\n    void save_ppm(const char* path);\\n};"},
    {t:"Create an abstract syntax tree with pattern matching",c:"#include <variant>\\n#include <memory>\\nstruct Num { double val; };\\nstruct BinOp { char op; std::unique_ptr<struct Expr> left, right; };\\nusing Expr = std::variant<Num, BinOp>;\\ndouble eval(const Expr& e);"},
    {t:"Implement a compile-time neural network",c:"template<int In, int Out>\\nstruct Layer { float weights[In][Out]; float bias[Out]; };\\ntemplate<int... Sizes>\\nstruct Network { /* compile-time layer chain */ };\\ntemplate<int In, int Out>\\nvoid forward(const Layer<In,Out>& l, const float input[In], float output[Out]);"},
    {t:"Build a transactional memory system using C++20",c:"#include <atomic>\\n#include <functional>\\nclass TxVar {\\n    std::atomic<int> value; std::atomic<uint64_t> version;\\npublic:\\n    int read(uint64_t tx_version);\\n    bool write(int val, uint64_t tx_version);\\n};\\nclass Transaction {\\npublic:\\n    bool execute(std::function<void()> fn);\\n};"},
    {t:"Create a CRDT last-writer-wins register",c:"template<typename T>\\nstruct LWWRegister {\\n    T value; uint64_t timestamp; int node_id;\\n    void update(T val, uint64_t ts, int node) { if(ts > timestamp || (ts == timestamp && node > node_id)) { value=val; timestamp=ts; node_id=node; } }\\n    void merge(const LWWRegister& other) { update(other.value, other.timestamp, other.node_id); }\\n};"},
    {t:"Implement a zero-copy networking framework",c:"#include <sys/socket.h>\\nclass ZeroCopySocket {\\n    int fd;\\npublic:\\n    ssize_t sendfile(int src_fd, off_t offset, size_t count);\\n    ssize_t splice(int pipe_fd, size_t len);\\n    void* mmap_recv(size_t len);\\n};"},
    {t:"Build a parallel graph algorithm framework",c:"#include <thread>\\n#include <vector>\\nclass ParallelGraph {\\n    std::vector<std::vector<int>> adj;\\n    int num_threads;\\npublic:\\n    std::vector<int> parallel_bfs(int start);\\n    std::vector<double> parallel_pagerank(int iterations);\\n    int parallel_connected_components();\\n};"},
    {t:"Create a hardware-aware cache-oblivious algorithm",c:"template<typename T>\\nvoid cache_oblivious_transpose(T* src, T* dst, int n, int rs, int cs, int rd, int cd, int size) {\\n    if(size <= 32) { /* base case */ }\\n    else { /* recursive divide */ }\\n}"},
    {t:"Implement a distributed shared memory abstraction",c:"class DSMPage { char data[4096]; int owner; bool modified; };\\nclass DSM {\\n    std::vector<DSMPage> pages;\\n    int node_id;\\npublic:\\n    char* read(int page_id);\\n    void write(int page_id, const char* data, size_t len);\\n    void invalidate(int page_id);\\n    void sync();\\n};"},
  ];
  if(diff==='easy') return e;
  if(diff==='medium') return m;
  return h;
}

// For remaining skills, create shorter but complete template sets
function makeDockerProblems(diff) {
  const titles = {
    easy: ["Write a multi-stage Dockerfile for a Node.js app","Create a Dockerfile with non-root user","Build a Python app Dockerfile with pip caching","Write a Dockerfile for a Go binary","Create a .dockerignore for a web project","Build a Dockerfile with health checks","Write a Dockerfile for a Java Spring Boot app","Create a minimal Alpine-based image","Build a Dockerfile with build arguments","Write a Dockerfile for a static site with Nginx","Create a Dockerfile with ENTRYPOINT and CMD","Build a multi-arch Dockerfile","Write a Dockerfile for a Rust binary","Create a Dockerfile with volume mounts","Build a Dockerfile for a Redis-backed app","Write a Dockerfile with environment variables","Create a Dockerfile for a React production build","Build a security-hardened Dockerfile","Write a Dockerfile for a database migration tool","Create a Dockerfile with init scripts"],
    medium: ["Configure Docker Compose with healthchecks and networking","Create a Docker Compose stack with service dependencies","Build a Docker Compose setup for microservices","Write a Docker Compose config with secrets management","Create a development environment with hot-reload","Configure a reverse proxy with Docker networks","Build a monitoring stack with Prometheus and Grafana","Write a Docker Compose for a Kafka cluster","Create a CI/CD pipeline Dockerfile","Configure log aggregation with Docker logging drivers","Build a multi-service app with shared volumes","Write a Docker Compose for a database cluster","Create a load-balanced service configuration","Configure Docker networks for service isolation","Build a development vs production compose override","Write a Docker Compose with resource limits","Create a Compose file for an ELK stack","Configure container orchestration with restart policies","Build a Docker Compose for a message queue system","Write a Compose config with external networks"],
    hard: ["Configure an overlay network with encryption for Swarm","Build a custom Docker network plugin","Create a Swarm service with rolling updates and rollback","Write a Docker plugin for custom storage drivers","Configure Docker Content Trust for image signing","Build a multi-tenant Docker platform","Create a Docker-in-Docker CI pipeline","Write custom Buildkit frontend","Configure Swarm secrets rotation","Build a service mesh using Docker networks","Create an auto-scaling Docker service","Write a custom Docker healthcheck orchestrator","Configure namespace isolation for containers","Build a Docker registry with authentication","Create a container runtime security policy","Write a Docker Compose for disaster recovery","Configure rate limiting for Docker API","Build a blue-green deployment with Docker","Create a canary release pipeline with Docker","Write a zero-downtime deployment strategy"],
  };
  const code = {
    easy: "# Dockerfile\\nFROM node:18-alpine AS builder\\nWORKDIR /app\\nCOPY package*.json ./\\nRUN npm ci --only=production\\nCOPY . .\\nRUN npm run build\\n\\nFROM node:18-alpine\\nWORKDIR /app\\nCOPY --from=builder /app/dist ./dist\\nCOPY --from=builder /app/node_modules ./node_modules\\nEXPOSE 3000\\nCMD [\"node\", \"dist/index.js\"]",
    medium: "version: '3.8'\\nservices:\\n  web:\\n    build: .\\n    ports:\\n      - '3000:3000'\\n    depends_on:\\n      db:\\n        condition: service_healthy\\n    healthcheck:\\n      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']\\n      interval: 10s\\n      timeout: 5s\\n      retries: 3\\n  db:\\n    image: postgres:15\\n    environment:\\n      POSTGRES_PASSWORD: secret\\n    healthcheck:\\n      test: ['CMD-SHELL', 'pg_isready']\\n      interval: 5s",
    hard: "# Advanced Swarm overlay configuration\\n# Configure encrypted overlay network\\ndocker network create \\\\\\n  --driver overlay \\\\\\n  --opt encrypted \\\\\\n  --subnet 10.0.0.0/24 \\\\\\n  --attachable \\\\\\n  secure-network\\n\\n# Deploy with rolling updates\\ndocker service create \\\\\\n  --name app \\\\\\n  --network secure-network \\\\\\n  --replicas 3 \\\\\\n  --update-parallelism 1 \\\\\\n  --update-delay 10s \\\\\\n  --rollback-parallelism 1 \\\\\\n  --rollback-monitor 30s \\\\\\n  app:latest",
  };
  return titles[diff].map(t => ({ t, c: code[diff] }));
}

function makeK8sProblems(diff) {
  const titles = {
    easy: ["Write a Deployment with readiness and liveness probes","Create a Service manifest for internal communication","Build a ConfigMap for application configuration","Write a Secret manifest for database credentials","Create a PersistentVolumeClaim for storage","Build a Job manifest for batch processing","Write an Ingress rule for HTTP routing","Create a Namespace with resource quotas","Build a CronJob for scheduled tasks","Write a Pod with init containers","Create a DaemonSet for node-level logging","Build a StatefulSet for database replicas","Write a HorizontalPodAutoscaler manifest","Create a NetworkPolicy for pod isolation","Build a ServiceAccount with RBAC roles","Write a PodDisruptionBudget","Create a LimitRange for namespace defaults","Build a ResourceQuota manifest","Write a Priority class for pod scheduling","Create an Affinity rule for pod placement"],
    medium: ["Configure a canary deployment with rolling updates","Create a Helm chart for a microservice","Build an Istio virtual service for traffic splitting","Write a custom metrics HPA configuration","Create a pod security policy","Configure cert-manager for TLS certificates","Build a multi-cluster service mesh","Write a Kustomize overlay for environments","Create a GitOps deployment pipeline","Configure external-dns for automatic DNS","Build a stateful application with operator","Write a sidecar injection configuration","Create a service mesh with mTLS","Configure cluster autoscaler policies","Build a backup strategy for persistent volumes","Write a blue-green deployment manifest","Create a pod topology spread constraint","Configure Vault integration for secrets","Build a rate limiting policy for services","Write a gRPC load balancing configuration"],
    hard: ["Implement a custom Kubernetes operator with CRDs","Build a mutating admission webhook","Create a custom scheduler extender","Write a CNI plugin configuration","Implement a custom controller for auto-remediation","Build a multi-cluster federation setup","Create a custom metrics API server","Write a validating webhook for policy enforcement","Implement a chaos engineering operator","Build a custom ingress controller","Create an OPA Gatekeeper policy framework","Write a custom resource with status subresource","Implement a service mesh data plane","Build a serverless framework on Kubernetes","Create a cluster API provider","Write a node problem detector plugin","Implement a cost optimization operator","Build a multi-tenant platform with isolation","Create a progressive delivery controller","Write a Kubernetes API aggregation layer"],
  };
  const code = {
    easy: "apiVersion: apps/v1\\nkind: Deployment\\nmetadata:\\n  name: app\\nspec:\\n  replicas: 3\\n  selector:\\n    matchLabels:\\n      app: web\\n  template:\\n    metadata:\\n      labels:\\n        app: web\\n    spec:\\n      containers:\\n      - name: web\\n        image: app:latest\\n        ports:\\n        - containerPort: 8080\\n        resources:\\n          limits:\\n            cpu: '500m'\\n            memory: '256Mi'\\n        readinessProbe:\\n          httpGet:\\n            path: /health\\n            port: 8080\\n          initialDelaySeconds: 5",
    medium: "apiVersion: networking.istio.io/v1beta1\\nkind: VirtualService\\nmetadata:\\n  name: app-vs\\nspec:\\n  hosts:\\n  - app\\n  http:\\n  - match:\\n    - headers:\\n        x-canary:\\n          exact: 'true'\\n    route:\\n    - destination:\\n        host: app\\n        subset: canary\\n  - route:\\n    - destination:\\n        host: app\\n        subset: stable\\n      weight: 90\\n    - destination:\\n        host: app\\n        subset: canary\\n      weight: 10",
    hard: "apiVersion: apiextensions.k8s.io/v1\\nkind: CustomResourceDefinition\\nmetadata:\\n  name: apps.custom.io\\nspec:\\n  group: custom.io\\n  versions:\\n  - name: v1\\n    served: true\\n    storage: true\\n    schema:\\n      openAPIV3Schema:\\n        type: object\\n        properties:\\n          spec:\\n            type: object\\n            properties:\\n              replicas:\\n                type: integer\\n              image:\\n                type: string\\n  scope: Namespaced\\n  names:\\n    plural: apps\\n    singular: app\\n    kind: App",
  };
  return titles[diff].map(t => ({ t, c: code[diff] }));
}

function makeAWSProblems(diff) {
  const titles = {
    easy: ["Create a least-privilege IAM policy for S3 access","Write a CloudFormation template for an EC2 instance","Build an S3 bucket policy with CORS configuration","Create an SQS queue with dead-letter queue","Write a Lambda function handler for API Gateway","Build a DynamoDB table with GSI","Create a VPC with public and private subnets","Write an SNS topic with subscription filters","Build a CloudWatch alarm for CPU utilization","Create an RDS instance with Multi-AZ","Write an Elastic Load Balancer configuration","Build an Auto Scaling group policy","Create an S3 lifecycle policy for archival","Write a Route53 health check","Build an IAM role with assume role policy","Create a CloudFront distribution","Write a Parameter Store configuration","Build an ECR repository with lifecycle policy","Create a Security Group with ingress rules","Write an EventBridge rule for scheduled events"],
    medium: ["Design a multi-region Route53 failover configuration","Create a Step Functions workflow for order processing","Build a CDK stack for a serverless API","Write a cross-account IAM role chain","Configure API Gateway with custom authorizer","Build a Kinesis data stream processing pipeline","Create a multi-AZ RDS with read replicas","Write a CloudFormation nested stack","Configure WAF rules for API protection","Build an ECS Fargate service with auto-scaling","Create a DynamoDB single-table design","Write a Lambda@Edge for request transformation","Configure VPC peering across regions","Build a CI/CD pipeline with CodePipeline","Create an ElastiCache cluster with failover","Write a Cognito user pool with custom auth","Configure S3 replication across regions","Build an API Gateway WebSocket API","Create a Service Catalog product","Write a Config rule for compliance checking"],
    hard: ["Implement a serverless event-driven Step Functions orchestrator","Build a multi-account landing zone with Organizations","Create a real-time data lake with Lake Formation","Write a custom CloudFormation resource provider","Design a disaster recovery architecture with RPO<1min","Build a zero-trust network architecture","Create a SageMaker ML pipeline with auto-training","Write a custom GuardDuty threat detector","Implement a multi-region active-active architecture","Build a serverless GraphQL API with AppSync","Create a cost optimization automation framework","Write a custom Control Tower guardrail","Implement a data mesh architecture on AWS","Build a compliance-as-code framework","Create a multi-tenant SaaS platform on EKS","Write a custom service quota manager","Implement a global content delivery optimization","Build a secure data pipeline with encryption","Create an automated incident response system","Write a capacity planning automation framework"],
  };
  const code = {
    easy: "{\\n  \"Version\": \"2012-10-17\",\\n  \"Statement\": [\\n    {\\n      \"Effect\": \"Allow\",\\n      \"Action\": [\\n        \"s3:GetObject\",\\n        \"s3:PutObject\"\\n      ],\\n      \"Resource\": \"arn:aws:s3:::my-bucket/*\",\\n      \"Condition\": {\\n        \"StringEquals\": {\\n          \"s3:x-amz-acl\": \"bucket-owner-full-control\"\\n        }\\n      }\\n    }\\n  ]\\n}",
    medium: "{\\n  \"Comment\": \"Multi-region failover\",\\n  \"StartAt\": \"ProcessOrder\",\\n  \"States\": {\\n    \"ProcessOrder\": {\\n      \"Type\": \"Task\",\\n      \"Resource\": \"arn:aws:lambda:us-east-1:123:function:process\",\\n      \"Retry\": [{\\n        \"ErrorEquals\": [\"ServiceException\"],\\n        \"IntervalSeconds\": 2,\\n        \"MaxAttempts\": 3,\\n        \"BackoffRate\": 2.0\\n      }],\\n      \"Catch\": [{\\n        \"ErrorEquals\": [\"States.ALL\"],\\n        \"Next\": \"Fallback\"\\n      }],\\n      \"Next\": \"Complete\"\\n    },\\n    \"Fallback\": { \"Type\": \"Pass\", \"End\": true },\\n    \"Complete\": { \"Type\": \"Succeed\" }\\n  }\\n}",
    hard: "# Step Functions ASL Definition for complex orchestration\\n# Implement parallel processing with error handling\\n{\\n  \"Comment\": \"Complex event-driven workflow\",\\n  \"StartAt\": \"ValidateInput\",\\n  \"States\": {\\n    \"ValidateInput\": {\\n      \"Type\": \"Task\",\\n      \"Resource\": \"arn:aws:lambda:region:account:function:validate\",\\n      \"Next\": \"ParallelProcess\"\\n    },\\n    \"ParallelProcess\": {\\n      \"Type\": \"Parallel\",\\n      \"Branches\": [\\n        { \"StartAt\": \"Branch1\", \"States\": { \"Branch1\": { \"Type\": \"Task\", \"Resource\": \"arn:aws:lambda:region:account:function:branch1\", \"End\": true } } },\\n        { \"StartAt\": \"Branch2\", \"States\": { \"Branch2\": { \"Type\": \"Task\", \"Resource\": \"arn:aws:lambda:region:account:function:branch2\", \"End\": true } } }\\n      ],\\n      \"End\": true\\n    }\\n  }\\n}",
  };
  return titles[diff].map(t => ({ t, c: code[diff] }));
}

function makeReactProblems(diff) {
  const titles = {
    easy: ["Implement a custom useLocalStorage hook","Create a reusable Modal component with portal","Build a toggle/switch component with accessibility","Write a custom useDebounce hook","Create a form input with validation","Build a responsive navigation bar","Write a custom useFetch data hook","Create a tooltip component with positioning","Build a pagination component","Write a custom useMediaQuery hook","Create an accordion/collapsible component","Build a search input with autocomplete dropdown","Write a custom usePrevious hook","Create a tabbed interface component","Build a progress bar component","Write a custom useInterval hook","Create a toast notification system","Build a drag-and-drop sortable list","Write a custom useOnClickOutside hook","Create a lazy-loaded image component"],
    medium: ["Create a virtualized list for rendering 10K items","Build a form library with schema-based validation","Implement a state machine hook for complex UI flows","Write a compound component pattern for menus","Create a context-based theme system with CSS variables","Build a real-time data dashboard with WebSocket","Implement an infinite scroll with intersection observer","Write a render prop pattern for data fetching","Create a multi-step wizard form","Build a keyboard shortcut manager hook","Implement a data grid with sorting and filtering","Write a code-split route system with Suspense","Create an optimistic UI update pattern","Build a collaborative text editor component","Implement a chart component with SVG","Write a file upload with drag-drop and preview","Create a state management solution using useReducer","Build an accessible date picker","Implement a notification queue with animations","Write a virtual keyboard component"],
    hard: ["Implement a concurrent React fiber scheduler simulator","Build a virtual DOM reconciliation engine","Create a compiler for JSX to render calls","Write a custom React renderer for canvas","Implement a signals-based reactivity system","Build a server-side rendering framework","Create a progressive hydration strategy","Write a React devtools extension","Implement a component-level code splitting optimizer","Build a layout engine for responsive grids","Create a gesture recognition system for touch UIs","Write a zero-bundle-size CSS-in-JS solution","Implement a resumable rendering strategy","Build a micro-frontend composition framework","Create a visual component editor with live preview","Write a tree-shakeable component library builder","Implement an incremental static regeneration system","Build a concurrent data fetching framework","Create a cross-platform rendering abstraction","Write a performance profiling framework"],
  };
  const code = {
    easy: "import { useState, useEffect } from 'react';\\n\\nexport function useLocalStorage(key, initialValue) {\\n  const [value, setValue] = useState(() => {\\n    const stored = localStorage.getItem(key);\\n    return stored ? JSON.parse(stored) : initialValue;\\n  });\\n\\n  useEffect(() => {\\n    localStorage.setItem(key, JSON.stringify(value));\\n  }, [key, value]);\\n\\n  return [value, setValue];\\n}",
    medium: "import { useState, useEffect, useRef, useCallback } from 'react';\\n\\nexport function VirtualList({ items, itemHeight, windowHeight }) {\\n  const [scrollTop, setScrollTop] = useState(0);\\n  const containerRef = useRef();\\n\\n  const startIndex = Math.floor(scrollTop / itemHeight);\\n  const endIndex = Math.min(startIndex + Math.ceil(windowHeight / itemHeight) + 1, items.length);\\n  const visibleItems = items.slice(startIndex, endIndex);\\n\\n  return (\\n    <div ref={containerRef} style={{ height: windowHeight, overflow: 'auto' }}\\n      onScroll={e => setScrollTop(e.target.scrollTop)}>\\n      <div style={{ height: items.length * itemHeight, position: 'relative' }}>\\n        {visibleItems.map((item, i) => (\\n          <div key={startIndex + i} style={{ position: 'absolute', top: (startIndex + i) * itemHeight, height: itemHeight }}>\\n            {item}\\n          </div>\\n        ))}\\n      </div>\\n    </div>\\n  );\\n}",
    hard: "// React Fiber Scheduler Simulator\\nclass FiberNode {\\n  constructor(type, props) {\\n    this.type = type;\\n    this.props = props;\\n    this.child = null;\\n    this.sibling = null;\\n    this.return = null;\\n    this.effectTag = null;\\n  }\\n}\\n\\nclass Scheduler {\\n  constructor() {\\n    this.workQueue = [];\\n    this.currentFiber = null;\\n  }\\n\\n  scheduleWork(fiber) { /* add to queue with priority */ }\\n  performUnitOfWork(fiber) { /* process one fiber */ }\\n  commitWork() { /* apply effects to DOM */ }\\n  workLoop(deadline) {\\n    while (this.currentFiber && deadline.timeRemaining() > 0) {\\n      this.currentFiber = this.performUnitOfWork(this.currentFiber);\\n    }\\n  }\\n}",
  };
  return titles[diff].map(t => ({ t, c: code[diff] }));
}

function makeNodeProblems(diff) {
  const titles = {
    easy: ["Create a cluster-based worker manager","Implement a file system watcher with debouncing","Build a simple HTTP router from scratch","Write a stream-based file copy utility","Create an event-driven task queue","Implement a CLI tool with interactive prompts","Build a simple static file server","Write a logging middleware for HTTP requests","Create a rate limiter middleware","Implement a basic WebSocket echo server","Build a process spawner with output capture","Write a file-based configuration loader","Create a simple caching proxy","Implement a health check endpoint","Build a CSV to JSON converter stream","Write a graceful shutdown handler","Create a request validation middleware","Implement a simple pub-sub using EventEmitter","Build an in-memory session store","Write a basic authentication middleware"],
    medium: ["Implement a streaming JSON parser for large files","Build a connection pool manager for databases","Create a worker thread pool for CPU tasks","Write a circuit breaker for external services","Implement a distributed job scheduler","Build a real-time notification system","Create a message queue consumer with backpressure","Write a custom Transform stream for data pipelines","Implement an API rate limiter with Redis","Build a file upload handler with multipart parsing","Create a GraphQL server with DataLoader","Write a WebSocket room manager","Implement a distributed cache with invalidation","Build a log aggregator with rotation","Create an OAuth2 authorization server","Write a database migration runner","Implement a request retry with circuit breaker","Build a server-sent events broadcaster","Create a task priority queue with workers","Write a gRPC server with streaming"],
    hard: ["Create a native C++ addon with N-API bindings","Build a custom HTTP/2 server implementation","Implement a distributed consensus module","Write a real-time collaboration CRDT engine","Create a custom V8 isolate manager","Build a zero-downtime deployment orchestrator","Implement a binary protocol parser generator","Write a distributed tracing system","Create a custom module loader and bundler","Build an edge computing runtime","Implement a sandboxed code execution engine","Write a distributed lock manager","Create a custom database engine with B-tree index","Build a service mesh sidecar proxy","Implement a real-time stream processing engine","Write a custom garbage collection analyzer","Create a serverless function runtime","Build a distributed event sourcing framework","Implement a custom TLS termination proxy","Write a WebAssembly runtime integration"],
  };
  const code = {
    easy: "const cluster = require('cluster');\\nconst numCPUs = require('os').cpus().length;\\n\\nif (cluster.isPrimary) {\\n  console.log(`Primary ${process.pid} starting ${numCPUs} workers`);\\n  for (let i = 0; i < numCPUs; i++) cluster.fork();\\n  cluster.on('exit', (worker) => {\\n    console.log(`Worker ${worker.process.pid} died, restarting...`);\\n    cluster.fork();\\n  });\\n} else {\\n  const http = require('http');\\n  http.createServer((req, res) => {\\n    res.end(`Worker ${process.pid}`);\\n  }).listen(8000);\\n}",
    medium: "const { Transform } = require('stream');\\n\\nclass JSONParser extends Transform {\\n  constructor() {\\n    super({ objectMode: true });\\n    this.buffer = '';\\n  }\\n\\n  _transform(chunk, encoding, callback) {\\n    this.buffer += chunk.toString();\\n    // Parse complete JSON objects from buffer\\n    let boundary;\\n    while ((boundary = this.buffer.indexOf('\\\\n')) !== -1) {\\n      const line = this.buffer.slice(0, boundary);\\n      this.buffer = this.buffer.slice(boundary + 1);\\n      try {\\n        this.push(JSON.parse(line));\\n      } catch(e) { /* skip invalid */ }\\n    }\\n    callback();\\n  }\\n}",
    hard: "// N-API native addon binding\\n// Implement in C++ with napi.h\\n#include <napi.h>\\n\\nNapi::Value ComputeHash(const Napi::CallbackInfo& info) {\\n  Napi::Env env = info.Env();\\n  std::string input = info[0].As<Napi::String>();\\n  // Compute hash\\n  return Napi::String::New(env, \"hash_result\");\\n}\\n\\nNapi::Object Init(Napi::Env env, Napi::Object exports) {\\n  exports.Set(\"computeHash\", Napi::Function::New(env, ComputeHash));\\n  return exports;\\n}\\nNODE_API_MODULE(addon, Init)",
  };
  return titles[diff].map(t => ({ t, c: code[diff] }));
}

function makeHTMLProblems(diff) {
  const titles = {
    easy: ["Create an accessible modal dialog with keyboard trap","Build a responsive card grid layout","Write a semantic HTML form with validation","Create a CSS-only hamburger menu","Build an accessible navigation with ARIA labels","Write a responsive image gallery with CSS Grid","Create a custom checkbox and radio button styles","Build a CSS flexbox holy grail layout","Write a skip navigation link for accessibility","Create a responsive table with horizontal scroll","Build a CSS-only accordion","Write a semantic article layout with aside","Create a custom scrollbar with CSS","Build a responsive footer with grid","Write accessible tab panels with ARIA","Create a CSS custom properties theme system","Build a responsive hero section","Write a print-friendly stylesheet","Create a CSS-only tooltip","Build a form with floating labels"],
    medium: ["Create a responsive CSS subgrid card layout","Build a CSS container query component system","Write a CSS-only carousel with scroll snap","Create an advanced CSS animation system","Build a responsive dashboard layout","Write a CSS Houdini custom paint worklet","Create a CSS logical properties layout","Build a responsive email template","Write a complex CSS gradient background","Create a CSS-only star rating component","Build an accessible data visualization","Write a CSS mask and clip-path composition","Create a responsive timeline component","Build a CSS blend mode photo editor","Write a CSS-only progress stepper","Create a responsive masonry layout","Build a CSS custom counter system","Write a complex SVG animation with CSS","Create a CSS subgrid form layout","Build an accessible autocomplete dropdown"],
    hard: ["Design a pure CSS 3D parallax cube system","Create a CSS Houdini layout API implementation","Build a CSS-only state machine for UI","Write a performant CSS containment strategy","Create a CSS motion path animation system","Build a CSS-only drag-and-drop interface","Write a CSS painting API for custom borders","Create a CSS scroll-driven animation system","Build a CSS-only spreadsheet grid","Write a CSS typed OM manipulation strategy","Create a CSS anchor positioning layout","Build a CSS scope-based component styling system","Write a CSS layer-based architecture","Create a CSS view transitions API implementation","Build a CSS-only physics simulation","Write a CSS custom highlight API usage","Create a responsive CSS-only game interface","Build a CSS-only code syntax highlighter","Write a performant CSS animation orchestrator","Create a CSS-only interactive data chart"],
  };
  const code = {
    easy: "<div role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"modal-title\">\\n  <h2 id=\"modal-title\">Dialog Title</h2>\\n  <div class=\"modal-body\">\\n    <p>Content goes here</p>\\n  </div>\\n  <button aria-label=\"Close dialog\">×</button>\\n</div>\\n<style>\\n.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: grid; place-items: center; }\\n[role='dialog'] { background: white; padding: 2rem; border-radius: 8px; max-width: 500px; }\\n</style>",
    medium: ".grid {\\n  display: grid;\\n  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));\\n  gap: 1rem;\\n}\\n.card {\\n  display: grid;\\n  grid-template-rows: subgrid;\\n  grid-row: span 3;\\n  border: 1px solid #ddd;\\n  border-radius: 8px;\\n  overflow: hidden;\\n}\\n.card > img { width: 100%; aspect-ratio: 16/9; object-fit: cover; }\\n.card > .content { padding: 1rem; }\\n.card > .footer { padding: 1rem; border-top: 1px solid #eee; }",
    hard: ".scene { perspective: 1000px; width: 200px; height: 200px; }\\n.cube {\\n  width: 100%; height: 100%;\\n  position: relative;\\n  transform-style: preserve-3d;\\n  animation: rotate 10s infinite linear;\\n}\\n.face {\\n  position: absolute; width: 200px; height: 200px;\\n  border: 2px solid rgba(255,255,255,0.3);\\n  display: grid; place-items: center;\\n}\\n.front  { transform: translateZ(100px); }\\n.back   { transform: rotateY(180deg) translateZ(100px); }\\n.right  { transform: rotateY(90deg) translateZ(100px); }\\n.left   { transform: rotateY(-90deg) translateZ(100px); }\\n.top    { transform: rotateX(90deg) translateZ(100px); }\\n.bottom { transform: rotateX(-90deg) translateZ(100px); }\\n@keyframes rotate { to { transform: rotateX(360deg) rotateY(360deg); } }",
  };
  return titles[diff].map(t => ({ t, c: code[diff] }));
}

// ── MAIN: Generate the database.js file ──

let output = `const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON;");

  // 1. Companies Table (NEW)
  db.run(\`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL
    )
  \`);

  // 2. Users Table (with company_id)
  db.run(\`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      role TEXT NOT NULL CHECK(role IN ('student', 'recruiter')),
      college TEXT,
      company TEXT,
      company_id TEXT,
      whatsapp TEXT,
      profile_slug TEXT UNIQUE,
      skillproof_score REAL DEFAULT 0.00,
      created_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    )
  \`);

  // 3. Skills Table
  db.run(\`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      challenge_type TEXT NOT NULL CHECK(challenge_type IN ('code', 'mcq', 'design'))
    )
  \`);

  // 4. Student Skills Table
  db.run(\`
    CREATE TABLE IF NOT EXISTS student_skills (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      self_rating INTEGER CHECK(self_rating BETWEEN 1 AND 5),
      status TEXT NOT NULL CHECK(status IN ('claimed', 'verified', 'failed')),
      verified_score REAL,
      verified_at TEXT,
      verified_by TEXT,
      badge_tag TEXT,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    )
  \`);

  // 5. Questions Table
  db.run(\`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL,
      title TEXT NOT NULL,
      difficulty TEXT NOT NULL CHECK(difficulty IN ('easy', 'medium', 'hard')),
      expiration_minutes INTEGER NOT NULL DEFAULT 10,
      code_template TEXT NOT NULL,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    )
  \`);

  // 6. Challenges Table (with company_id)
  db.run(\`
    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      recruiter_id TEXT,
      skill_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      difficulty TEXT NOT NULL CHECK(difficulty IN ('easy', 'medium', 'hard')),
      time_limit_mins INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'active', 'submitted', 'evaluated', 'expired', 'disqualified')),
      started_at TEXT,
      submitted_at TEXT,
      expires_at TEXT,
      violations_count INTEGER DEFAULT 0,
      company_id TEXT,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recruiter_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    )
  \`);

  // 7. Submissions Table
  db.run(\`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      challenge_id TEXT NOT NULL,
      code TEXT NOT NULL,
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    )
  \`);

  // 8. Evaluations Table
  db.run(\`
    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      challenge_id TEXT NOT NULL,
      total_score REAL NOT NULL,
      ai_summary TEXT,
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    )
  \`);

  // 9. Violations Table
  db.run(\`
    CREATE TABLE IF NOT EXISTS violations (
      id TEXT PRIMARY KEY,
      challenge_id TEXT NOT NULL,
      type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    )
  \`);

  // ── Seed Skills and ~4000 Story-Based Questions ──
  db.get("SELECT COUNT(*) as count FROM skills", (err, row) => {
    if (err) return;
    if (row.count === 0) {
      console.log("Seeding 14 technologies and ~4000 scenario-based questions...");

      db.serialize(() => {
        const skillList = [
          { name: "Python Programming", category: "Software Engineering" },
          { name: "C Systems Programming", category: "Systems Engineering" },
          { name: "SQL Database Design", category: "Data Systems" },
          { name: "JavaScript", category: "Web Development" },
          { name: "TypeScript", category: "Web Development" },
          { name: "Go", category: "Software Engineering" },
          { name: "Rust", category: "Systems Engineering" },
          { name: "C++", category: "Systems Engineering" },
          { name: "Docker", category: "DevOps" },
          { name: "Kubernetes", category: "DevOps" },
          { name: "AWS", category: "Cloud Computing" },
          { name: "React", category: "Web Development" },
          { name: "Node.js", category: "Web Development" },
          { name: "HTML5 & CSS3", category: "Web Development" }
        ];

        const stmtSkills = db.prepare("INSERT INTO skills (id, name, category, challenge_type) VALUES (?, ?, ?, 'code')");
        const skillMap = {};
        skillList.forEach(s => {
          const sId = crypto.randomUUID();
          skillMap[s.name] = sId;
          stmtSkills.run(sId, s.name, s.category);
        });
        stmtSkills.finalize();

`;

// Now generate the question seeding code
output += `        // ── Scenario Contexts ──
        const scenarios = ${JSON.stringify(scenarios)};

        const stmtQs = db.prepare("INSERT INTO questions (id, skill_id, title, difficulty, expiration_minutes, code_template) VALUES (?, ?, ?, ?, ?, ?)");
        const expirationMap = { easy: 5, medium: 10, hard: 15 };
        let totalQuestions = 0;

`;

// For each skill, generate question insertion code
for (const skill of skills) {
  const problems = getProblems(skill.name);
  
  output += `        // ── ${skill.name} Questions ──\n`;
  
  for (const diff of ['easy', 'medium', 'hard']) {
    const probs = problems[diff];
    if (!probs || probs.length === 0) continue;
    
    // We combine scenarios with problems to generate many questions
    // Target: ~95 per skill per difficulty
    // With 20 scenarios and 20 problems, we pick combos
    output += `        // ${skill.name} - ${diff}\n`;
    output += `        {\n`;
    output += `          const problems_${diff} = ${JSON.stringify(probs.map(p => ({ t: p.t, c: p.c })))};\n`;
    output += `          const numProblems = problems_${diff}.length;\n`;
    output += `          const targetPerDiff = 95;\n`;
    output += `          for (let qi = 0; qi < targetPerDiff; qi++) {\n`;
    output += `            const prob = problems_${diff}[qi % numProblems];\n`;
    output += `            const scenario = scenarios[qi % scenarios.length];\n`;
    output += `            const title = scenario + ". " + prob.t;\n`;
    output += `            stmtQs.run(crypto.randomUUID(), skillMap["${skill.name}"], title, "${diff}", expirationMap["${diff}"], prob.c);\n`;
    output += `            totalQuestions++;\n`;
    output += `          }\n`;
    output += `        }\n\n`;
  }
}

output += `        stmtQs.finalize(() => {
          console.log(\`Database seeded with 14 technologies and \${totalQuestions} scenario-based questions.\`);
        });
      });
    }
  });
});

module.exports = db;
`;

// Write the file
const outPath = path.resolve(__dirname, 'database.js');
fs.writeFileSync(outPath, output, 'utf8');
console.log(`Generated database.js (${(output.length / 1024).toFixed(1)} KB)`);
console.log('Done!');
