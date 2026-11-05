"""새 배경 5장과 라벨 시트(3x3)를 public/img/*.webp 로 저장한다.
사용법: python3 tools/slice_labels.py <3인전경기> <교사대시보드> <2인전대기실> <2인전경기> <3인전대기실> <라벨시트>"""
import sys, os
from PIL import Image
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'img')
m3, dash, l2, m2, l3, sheet = sys.argv[1:7]
for src, name in [(m3, 's_match_3p'), (dash, 't_dashboard'), (l2, 's_lobby_1v1'), (m2, 's_match_1v1'), (l3, 's_lobby_3p')]:
    Image.open(src).convert('RGB').save(os.path.join(OUT, name + '.webp'), quality=88, method=6)
im = Image.open(sheet).convert('RGBA')
names = ['lb_death', 'lb_dicon', 'lb_rank', 'lb_wait', 'lb_got', 'lb_play', 'lb_2p', 'lb_3p', 'lb_blank']
xs = [(45, 584), (618, 1157), (1190, 1730)]; ys = [(118, 304), (361, 546), (603, 788)]
for i, n in enumerate(names):
    x, y = xs[i % 3], ys[i // 3]
    c = im.crop((x[0], y[0], x[1], y[1]))
    c = c.resize((360, round(360 * c.height / c.width)), Image.LANCZOS)
    c.save(os.path.join(OUT, n + '.webp'), quality=90, method=6)
print('ok')
