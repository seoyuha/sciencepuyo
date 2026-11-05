import sys; sys.path.insert(0,'/home/claude/slice')
import numpy as np
from PIL import Image
import importlib.util
spec=importlib.util.spec_from_file_location('sl','/home/claude/puyo/tools/slice_graphics.py')
src=open('/home/claude/puyo/tools/slice_graphics.py').read()
# 도우미 함수만 가져오기
ns={'__file__':'/home/claude/puyo/tools/slice_graphics.py'}; exec(src.split('# ---------- 전체 화면')[0].replace("G = sys.argv[1] if len(sys.argv) > 1 else 'puyo_neon_graphics_originals'","G='.'"), ns)
clean, crop, save, OUT = ns['clean'], ns['crop'], ns['save'], '/home/claude/puyo/public/img'
ns['OUT']=OUT
def sv(im,name,maxw=None,q=88):
    if maxw and im.width>maxw: im=im.resize((maxw,round(im.height*maxw/im.width)),Image.LANCZOS)
    im.save(f'{OUT}/{name}.webp','WEBP',quality=q,method=6)
# 전체 화면
Image.open('vs.png').convert('RGB').save(f'{OUT}/s_rank_vs.webp','WEBP',quality=86,method=6)
Image.open('board.png').convert('RGB').save(f'{OUT}/s_rank_board.webp','WEBP',quality=86,method=6)
# 버튼: 색은 1번 시트(NORMAL 글자 없음), 투명도는 2번 시트
A=np.array(Image.open('btns.png').convert('RGBA')); B=np.array(Image.open('btns2.png').convert('RGBA'))
mix=A.copy(); mix[:,:,3]=B[:,:,3]; MIX=Image.fromarray(mix); B2=Image.fromarray(B)
boxes=[(30,60,498,252,'rb_go',MIX),(533,60,1002,252,'rb_go_on',MIX),(1035,59,1505,252,'rb_sent',B2),(30,308,499,494,'rb_lock',B2),(534,308,1003,494,'rb_busy',B2),(1036,307,1508,495,'rb_tag',B2),
       (27,540,504,694,'rb_on',B2),(530,540,1009,694,'rb_off',B2),(1033,539,1510,694,'rb_blank',B2),(116,731,421,986,'ri_crown',B2),(656,744,880,987,'ri_lock',B2),(1137,757,1394,968,'ri_up',B2)]
for x0,y0,x1,y1,n,src_ in boxes: sv(clean(crop(src_,(x0,y0,x1,y1),8),r=6,core=180),n,maxw=360)
P=Image.open('popup.png').convert('RGBA')
for b,n in [((43,38,1197,659),'rp_challenged'),((27,734,1213,956),'rp_chal_ok'),((27,1006,1213,1228),'rp_def_ok')]: sv(clean(crop(P,b,10),r=8,core=180),n,maxw=760)
V=Image.open('evb.png').convert('RGBA')
for b,n in zip([(46,105,938,388),(983,105,1876,388),(46,444,938,728),(983,444,1876,728)],['fog','reverse','bomb','king']): sv(clean(crop(V,b,10),r=8,core=180),'b_'+n,maxw=700)
print('ok')
