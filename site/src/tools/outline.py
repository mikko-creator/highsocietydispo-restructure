#!/usr/bin/env python3
"""outline.py - write src/content/home-outline.json: the reskin homepage's BODY as the server sent it
(audit/raw/client-highsocietydispo-reskin-index.html.html), flattened to the items the content gates read.

Items, in document order:
  {k:'text', t, ids, cls, placeholder, hidden}   a text run (whitespace-normalised, non-empty)
  {k:'a_open', href, aria, ids, cls} / {k:'a_close'}
  {k:'img', src, alt, ids, cls, hidden}          src = data-src (lazy) or src
  {k:'aria', v, tag, ids}                        every aria-label attribute
ids = the ids of every ancestor that has one (innermost last, the element's own id included).
placeholder = inside an <i class="empty-content"> editor placeholder; hidden = under a d-none / invisible /
display:none ancestor (flags only: nothing is filtered here, the gates decide).

  python3 -I src/tools/outline.py
"""
import json, os, re
from html.parser import HTMLParser

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RAW = open(os.path.join(ROOT, 'audit', 'raw', 'client-highsocietydispo-reskin-index.html.html'), encoding='utf-8').read()
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
SKIP = {'script', 'style', 'template', 'noscript', 'svg'}
norm = lambda s: re.sub(r'\s+', ' ', s.replace(' ', ' ')).strip()


class Outline(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # [{tag, id, cls, placeholder, hidden}]
        self.items = []
        self.in_body = False
        self.skip = 0

    def ctx(self):
        ids = [f['id'] for f in self.stack if f['id']]
        cls = self.stack[-1]['cls'] if self.stack else []
        return ids, cls, any(f['placeholder'] for f in self.stack), any(f['hidden'] for f in self.stack)

    def handle_starttag(self, tag, attrs):
        a = {k: (v if v is not None else '') for k, v in attrs}
        if tag == 'body': self.in_body = True; return
        if not self.in_body: return
        if self.skip or tag in SKIP:
            if tag not in VOID: self.skip += 1
            return
        cls = (a.get('class') or '').split()
        frame = {'tag': tag, 'id': a.get('id', ''), 'cls': cls,
                 'placeholder': tag == 'i' and 'empty-content' in cls,
                 'hidden': 'd-none' in cls or 'invisible' in cls or bool(re.search(r'display\s*:\s*none', a.get('style', '')))}
        self.stack.append(frame)
        ids, _, ph, hid = self.ctx()
        if a.get('aria-label'): self.items.append({'k': 'aria', 'v': a['aria-label'], 'tag': tag, 'ids': ids})
        if tag == 'a':
            self.items.append({'k': 'a_open', 'href': a.get('href', ''), 'aria': a.get('aria-label', ''), 'ids': ids, 'cls': cls, 'hidden': hid})
        elif tag == 'img':
            self.items.append({'k': 'img', 'src': a.get('data-src') or a.get('src', ''), 'alt': a.get('alt', ''), 'ids': ids, 'cls': cls, 'hidden': hid})
        if tag in VOID: self.stack.pop()

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID and self.in_body and not self.skip and self.stack and self.stack[-1]['tag'] == tag:
            self.stack.pop()

    def handle_endtag(self, tag):
        if not self.in_body: return
        if tag == 'body': self.in_body = False; return
        if self.skip:
            if tag in SKIP or tag not in VOID: self.skip -= 1
            return
        if tag in VOID: return
        # close up to the matching open tag (a stray close tag closes nothing)
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]['tag'] == tag:
                for f in self.stack[i:][::-1]:
                    if f['tag'] == 'a': self.items.append({'k': 'a_close'})
                del self.stack[i:]
                return

    def handle_data(self, d):
        if not self.in_body or self.skip: return
        t = norm(d)
        if not t: return
        ids, cls, ph, hid = self.ctx()
        self.items.append({'k': 'text', 't': t, 'ids': ids, 'cls': cls, 'placeholder': ph, 'hidden': hid})


o = Outline(); o.feed(RAW)
out = {'source': 'audit/raw/client-highsocietydispo-reskin-index.html.html', 'items': o.items}
json.dump(out, open(os.path.join(ROOT, 'src', 'content', 'home-outline.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
n = lambda k: sum(1 for i in o.items if i['k'] == k)
print('home-outline.json: %d text runs (%d placeholder, %d hidden), %d links, %d images, %d aria-labels' % (
    n('text'), sum(1 for i in o.items if i['k'] == 'text' and i['placeholder']), sum(1 for i in o.items if i['k'] == 'text' and i['hidden']),
    n('a_open'), n('img'), n('aria')))
