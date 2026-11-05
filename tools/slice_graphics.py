# 네온 그래픽 원본 → 게임에서 쓰는 조각(webp)으로 자르기
# 원본은 그대로 두고, 잘라 낸 조각만 public/img 에 저장해요.
import os, json, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

import sys
G = sys.argv[1] if len(sys.argv) > 1 else 'puyo_neon_graphics_originals'  # 압축을 푼 원본 폴더
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'img')
os.makedirs(OUT, exist_ok=True)
S = lambda f: Image.open(f'{G}/04_original_sheets/{f}').convert('RGBA')
meta = {}

def save(im, name, q=88, maxw=None):
    if maxw and im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    im.save(f'{OUT}/{name}.webp', 'WEBP', quality=q, method=6)
    meta[name] = [im.width, im.height]

def clean(im, r=4, core=200, feather=1.5):
    """뿌연 빛 번짐 잡티를 정리: 단단한 부분(core) 근처 r픽셀만 남겨요."""
    a = np.array(im)
    al = a[:, :, 3]
    c = al >= core
    c = nd.binary_opening(c, iterations=1)
    lab, n = nd.label(c)
    if n:
        sizes = nd.sum(c, lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * 0.02])
    else:
        keep = c
    keep = nd.binary_fill_holes(keep)
    if r: keep = nd.binary_dilation(keep, iterations=r)
    m = Image.fromarray((keep * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(feather))
    a[:, :, 3] = (al.astype(float) * np.array(m) / 255).astype('uint8')
    return Image.fromarray(a)

def crop(im, box, pad=0):
    x0, y0, x1, y1 = box
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))

def chamfer(im, c):
    """불투명 배경이 깔린 시트에서 자른 판의 모서리를 비스듬히 깎아 투명하게."""
    a = np.array(im); h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    out = (xx + yy < c) | ((w - 1 - xx) + yy < c) | (xx + (h - 1 - yy) < c) | ((w - 1 - xx) + (h - 1 - yy) < c)
    a[out, 3] = 0
    return Image.fromarray(a)

# ---------- 전체 화면 ----------
for d in ['02_student_screens', '03_teacher_screens', '01_backgrounds']:
    for f in sorted(os.listdir(f'{G}/{d}')):
        im = Image.open(f'{G}/{d}/{f}').convert('RGB')
        if im.size != (1672, 941): im = im.resize((1672, 941), Image.LANCZOS)
        save(im, ('s_' if d[1] == '2' else 't_' if d[1] == '3' else 'bg_') + f[3:-4] if d[1] != '1' else 'bg_' + f[:-4], q=86)

# ---------- 뿌요 6색 × 6동작 ----------
P = S('03_puyo_animation.png')
cols = [(22, 212), (232, 398), (412, 618), (622, 810), (808, 1048), (1046, 1262)]
rows = [(30, 240), (240, 444), (444, 642), (642, 842), (842, 1040), (1040, 1240)]
names = ['idle', 'fall', 'land', 'happy', 'glow', 'pop']
for ri, (y0, y1) in enumerate(rows):
    for ci, (x0, x1) in enumerate(cols):
        im = P.crop((x0, y0, x1, y1))
        im = clean(im, r=3 if ci < 4 else 10, core=200 if ci < 5 else 150)
        bb = im.getbbox()
        im = im.crop(bb)
        save(im, f'p{ri + 1}_{names[ci]}', maxw=160)

# ---------- 조작 버튼 (21: 위 기본 · 아래 눌림) ----------
C = S('21_controls_states.png')
cb = [(82, 412), (472, 801), (841, 1332), (1371, 1702), (1761, 2091)]
cn = ['left', 'rotL', 'drop', 'rotR', 'right']
for st, (y0, y1) in [('', (30, 346)), ('_on', (378, 694))]:
    for (x0, x1), n in zip(cb, cn):
        save(clean(C.crop((x0 - 8, y0, x1 + 8, y1)), r=6, core=180), f'c_{n}{st}', maxw=260)

# ---------- 카운트다운·정답·연쇄 ----------
K = S('07_countdown_feedback.png')
kb = [((70, 43, 506, 277), 'cd3'), ((599, 43, 1037, 277), 'cd2'), ((1128, 43, 1565, 277), 'cd1'), ((1658, 43, 2097, 277), 'cdgo'),
      ((24, 322, 530, 491), 'f_ok'), ((562, 322, 1070, 491), 'f_retry'), ((1100, 322, 1609, 491), 'f_perfect'), ((1639, 322, 2148, 491), 'f_good'),
      ((23, 533, 531, 695), 'ch2'), ((563, 533, 1070, 695), 'ch3'), ((1102, 533, 1608, 695), 'ch4'), ((1639, 532, 2148, 695), 'ch5')]
for b, n in kb: save(clean(crop(K, b, 14), r=8, core=180), n, maxw=420)

# ---------- 아이템·이벤트 아이콘 ----------
I = S('08_items.png')
ib = [(52, 38, 369, 347), (399, 38, 714, 348), (742, 38, 1059, 348), (1086, 38, 1399, 347),
      (52, 381, 369, 690), (399, 381, 714, 691), (742, 381, 1059, 691), (1086, 381, 1400, 691),
      (52, 725, 369, 1036), (399, 726, 714, 1036), (743, 725, 1059, 1036), (1086, 726, 1400, 1036)]
inames = ['color', 'clear', 'shield', 'star', 'fog', 'reverse', 'bomb', 'king', 'golden', 'fever', 'sprint', 'comeback']
for b, n in zip(ib, inames): save(clean(crop(I, b, 6), r=5, core=180), 'i_' + n, maxw=200)

# ---------- 이벤트 배너 ----------
B = S('14_event_banners.png')
bb = [(28, 69, 864, 284), (909, 69, 1746, 284), (28, 337, 864, 547), (910, 337, 1746, 547), (28, 603, 864, 818), (909, 603, 1746, 818)]
for b, n in zip(bb, ['fever', 'sprint', 'comeback', 'golden', 'shield', 'offset']): save(clean(crop(B, b, 10), r=7, core=180), 'b_' + n, maxw=700)

# ---------- 승패 ----------
R = S('05_result_popups.png')
for b, n in [((71, 62, 628, 282), 'r_win'), ((674, 101, 1167, 275), 'r_lose'), ((1207, 100, 1722, 275), 'r_draw'),
             ((34, 340, 871, 625), 'r_panel_c'), ((896, 340, 1741, 625), 'r_panel_m'),
             ((74, 691, 574, 846), 'r_ok'), ((637, 691, 1136, 846), 'r_close'), ((1198, 691, 1699, 846), 'r_cont')]:
    save(clean(crop(R, b, 10), r=8, core=180), n, maxw=700)

# ---------- 교사 버튼 (계속하기 등) ----------
T = S('06_teacher_buttons.png')
tb = {'tb_resume': (909, 90, 1288, 197), 'tb_pause': (486, 90, 865, 197), 'tb_start': (64, 90, 443, 197), 'tb_auto_on': (486, 548, 866, 652)}
for n, b in tb.items(): save(clean(crop(T, b, 10), r=6, core=180), n, maxw=380)

# ---------- 빈 버튼·배지 ----------
E = S('12_blank_button_states.png')
eb = [(24, 193, 365, 349), (383, 193, 718, 349), (734, 193, 1072, 349), (1087, 193, 1425, 349),
      (88, 437, 311, 663), (442, 437, 661, 663), (789, 437, 1011, 663), (1141, 437, 1361, 663),
      (22, 771, 368, 907), (381, 770, 722, 907), (729, 770, 1074, 908), (1081, 772, 1427, 907)]
en = ['rc', 'rd', 'rm', 'rg', 'qc', 'qd', 'qm', 'qg', 'hc', 'hd', 'hm', 'hg']
for b, n in zip(eb, en): save(clean(crop(E, b, 4), r=4, core=170), 'k_' + n, maxw=360)
U = S('16_unit_badges.png')
ub = [(27, 72, 434, 223), (468, 72, 872, 223), (904, 72, 1310, 223), (1344, 72, 1751, 223),
      (27, 496, 430, 629), (467, 496, 871, 629), (906, 496, 1309, 629), (1345, 496, 1751, 629),
      (29, 691, 430, 823), (466, 691, 872, 823), (905, 691, 1309, 823), (1344, 691, 1750, 823)]
un = ['u10', 'u11', 'u12', 'u99', 'g_learned', 'g_review', 'g_first', 'g_new', 'bl_c', 'bl_m', 'bl_y', 'bl_g']
for b, n in zip(ub, un): save(clean(crop(U, b, 8), r=6, core=170), n, maxw=360)

# ---------- 경기 상태 알림 (불투명 배경 → 모서리 깎기) ----------
M = S('13_match_status.png')
mb = {'m_pause': (47, 40, 734, 294), 'm_conn': (799, 40, 1486, 294), 'm_disc': (47, 345, 734, 624), 'm_find': (799, 345, 1486, 624),
      'm_ko': (47, 670, 734, 970), 'm_end': (799, 670, 1486, 970)}
for n, b in mb.items():
    im = crop(M, b); im = chamfer(im, 46); save(im, n, maxw=620)

# ---------- 운영 알림 ----------
A = S('17_admin_notifications.png')
ab = {'a_saved': (80, 45, 728, 320), 'a_upload': (808, 45, 1458, 320), 'a_uperr': (80, 370, 728, 640), 'a_backup': (808, 370, 1458, 640),
      'a_confirm': (80, 690, 728, 968), 'a_entry': (808, 690, 1458, 968)}
for n, b in ab.items():
    im = crop(A, b); im = chamfer(im, 44); save(im, n, maxw=620)

# ---------- 대결 정보 틀 ----------
H = S('20_match_hud.png')
hb = {'h_next': (40, 296, 370, 650), 'h_star': (416, 296, 742, 650), 'h_garb': (795, 296, 1120, 650), 'h_streak': (1168, 296, 1497, 650),
      'h_score': (30, 723, 380, 927), 'h_time': (406, 723, 752, 927), 'h_chain': (781, 723, 1127, 927), 'h_target': (1158, 723, 1507, 927)}
for n, b in hb.items():
    im = crop(H, b); im = chamfer(im, 30); save(im, n, maxw=300)

# ---------- 착지·경고·대상 (빛 번짐 잡티가 많아 강하게 정리) ----------
Q = S('15_ghost_target.png')
for n, b in {'t_x': (55, 380, 360, 675), 't_down': (770, 380, 1035, 665), 't_aim': (25, 705, 375, 1045)}.items():
    save(clean(crop(Q, b), r=4, core=215), n, maxw=200)

# ---------- 효과 ----------
F = S('09_effect_frames.png')
for n, b in {'e_burst': (770, 40, 1060, 280), 'e_shot': (760, 330, 1060, 500), 'e_shield': (420, 570, 680, 790)}.items():
    save(clean(crop(F, b), r=6, core=200), n, maxw=240)

# ---------- 로고·첫 화면 버튼 ----------
L = S('18_title_logo_puyos.png')
save(clean(crop(L, (171, 89, 1495, 510), 12), r=10, core=180), 'logo', maxw=900)
TB = S('19_title_button_states.png')
for b, n in [((35, 98, 858, 296), 'tt_start'), ((916, 98, 1741, 296), 'tt_start_on'), ((109, 378, 788, 570), 'tt_how'), ((985, 378, 1665, 570), 'tt_how_on'),
             ((109, 632, 788, 825), 'tt_teacher'), ((985, 633, 1666, 826), 'tt_teacher_on')]:
    save(clean(crop(TB, b, 8), r=8, core=180), n, maxw=500)

json.dump(meta, open(f'{OUT}/sizes.json', 'w'))
print(len(meta), 'files', sum(os.path.getsize(f'{OUT}/{k}.webp') for k in meta) // 1024, 'KB')
