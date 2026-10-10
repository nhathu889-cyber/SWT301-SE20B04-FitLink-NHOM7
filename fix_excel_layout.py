import sys,json,re,textwrap
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/'.excel-tools'))
import xlrd,xlwt
from xlutils.copy import copy
root=Path(__file__).parent
src=root/'FitLink_Unit_Test_Template_Completed.xls'
b=xlrd.open_workbook(str(src),formatting_info=True)
w=copy(b)
body=xlwt.easyxf('font: name Calibri, height 200; alignment: wrap on, vert top; borders: left thin, right thin, top thin, bottom thin')
head=xlwt.easyxf('font: name Calibri, height 200, bold on, colour white; pattern: pattern solid, fore_colour dark_blue; alignment: wrap on, vert centre, horiz centre; borders: left thin, right thin, top thin, bottom thin')
label=xlwt.easyxf('font: name Calibri, height 200, bold on; pattern: pattern solid, fore_colour ice_blue; alignment: wrap on, vert top; borders: left thin, right thin, top thin, bottom thin')
styles={
 'P':xlwt.easyxf('font: name Calibri, height 200, bold on, colour dark_green; pattern: pattern solid, fore_colour light_green; alignment: wrap on, vert centre, horiz centre; borders: left thin, right thin, top thin, bottom thin'),
 'F':xlwt.easyxf('font: name Calibri, height 200, bold on, colour dark_red; pattern: pattern solid, fore_colour rose; alignment: wrap on, vert centre, horiz centre; borders: left thin, right thin, top thin, bottom thin'),
 'U':xlwt.easyxf('font: name Calibri, height 200, bold on; pattern: pattern solid, fore_colour light_yellow; alignment: wrap on, vert centre, horiz centre; borders: left thin, right thin, top thin, bottom thin')}
for name,title in [('Function 1','Authentication'),('Function 2','Booking'),('Function3','Schedule')]:
 old=b.sheet_by_name(name);idx=b.sheet_names().index(name)
 ws=w.add_sheet('replacement_'+str(idx))
 sheets=w._Workbook__worksheets
 sheets.pop();sheets[idx]=ws;ws.name=name
 ws.col(0).width=26*256
 for c in range(1,9):ws.col(c).width=29*256
 ws.write_merge(0,0,0,8,'FitLink | '+title+' | Unit Test Results',head)
 ws.write_merge(1,1,0,8,f"Passed: {int(old.cell_value(6,0))}    Failed: {int(old.cell_value(6,2))}    Untested: {int(old.cell_value(6,5))}    Total: 8",label)
 ws.write_merge(2,2,0,8,'Executed by: Codex / Jest. Isolated unit tests with mocks. P = Passed; F = Failed; U = Untested. See Execution Evidence for scope.',body)
 ws.row(0).height=500;ws.row(1).height=450;ws.row(2).height=650
 labels=['Test Case ID','Precondition','Test case','Procedure','Expected result','Actual result / limitation','Type (N / A / B)','Result (P / F / U)','Executed date','Defect ID']
 source_rows=[8,10,14,18,22,34,38,39,40,41]
 for r,(caption,source_row) in enumerate(zip(labels,source_rows),4):
  ws.write(r,0,caption,head if r==4 else label)
  values=[str(old.cell_value(source_row,c)) for c in range(5,13)]
  max_lines=1
  for c,value in enumerate(values,1):
   value=value.replace('\ufffd',"'")
   ws.write(r,c,value,head if r==4 else styles.get(value,body) if source_row==39 else body)
   lines=sum(max(1,len(textwrap.wrap(line,width=27,break_long_words=True))) for line in value.split('\n'))
   max_lines=max(max_lines,lines)
  ws.row(r).height=min(8000,max(500,(max_lines+1)*260));ws.row(r).height_mismatch=True
 ws.panes_frozen=True;ws.horz_split_pos=5;ws.vert_split_pos=1
 ws.set_portrait(False);ws.paper_size_code=8
 ws.fit_width_to_pages=1;ws.fit_height_to_pages=0
 ws.print_scaling=100
 ws.print_area='A1:I14'
 ws.normal_magn=75
target=root/'FitLink_Unit_Test_Template_Fixed.xls'
w.save(str(target))
check=xlrd.open_workbook(str(target),formatting_info=True)
for name in ['Function 1','Function 2','Function3']:
 s=check.sheet_by_name(name)
 assert s.ncols==9 and s.nrows==14
 assert sum(s.cell_value(4,c).startswith('TC_') for c in range(1,9))==8
 for r in [4,5,6,7,8,9]:
  for c in range(1,9):
   xf=check.xf_list[s.cell_xf_index(r,c)]
   assert xf.alignment.text_wrapped==1 and xf.alignment.rotation==0
print(target)
print('Verified all 3 sheets: 8 cases each; wrapped horizontal text; original results retained.')
