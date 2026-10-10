import sys, json, re, datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / '.excel-tools'))
import xlrd, xlwt
from xlutils.copy import copy

root = Path(__file__).parent
source = Path(r'C:\Users\NHAT\Downloads\28_09_2026___0d7f8bae-2e31-4ece-968c-4a3fefc92389 (1) (1).xls')
book = xlrd.open_workbook(str(source), formatting_info=True)
out = copy(book)
results = json.loads((root/'testcase-results.json').read_text(encoding='utf-8-sig'))
run = json.loads((root/'testcase-jest-results.json').read_text(encoding='utf-8-sig'))
actual = {}
for suite in run['testResults']:
    for test in suite['assertionResults']:
        match = re.search(r'TC_(?:AUTH|BOOK|SCH)_\d{3}', test['fullName'])
        if match:
            actual[match[0]] = {'passed':'Passed','failed':'Failed','todo':'Pending','pending':'Pending'}[test['status']]
assert len(actual)==24
for key, value in actual.items(): results[key]['status']=value
cases=[]
for sheet in json.loads((root/'testcases-extracted.json').read_text(encoding='utf-8-sig')):
    for row in sheet['rows']:
        vals={re.sub(r'\d+','',k):v for k,v in row.items()}
        if str(vals.get('A','')).startswith('TC_'): cases.append(vals)
assert len(cases)==24
date=datetime.datetime.fromtimestamp(run['startTime']/1000).strftime('%Y-%m-%d %H:%M:%S')+' (Asia/Bangkok)'
def put(sheet,r,c,value):
    old=book.sheet_by_name(sheet)
    for r0,r1,c0,c1 in old.merged_cells:
        if r0<=r<r1 and c0<=c<c1 and (r,c)!=(r0,c0):return
    ws=out.get_sheet(book.sheet_names().index(sheet)); ws._cell_overwrite_ok=True
    existing=ws.row(r)._Row__cells.get(c)
    xf=existing.xf_idx if existing else None
    ws.write(r,c,value)
    if xf is not None:ws.row(r)._Row__cells[c].xf_idx=xf
def p(s,row,col,value):put(s,row-1,col-1,value)
p('Cover',4,2,'FitLink Backend');p('Cover',4,6,'Codex / Jest')
p('Cover',5,2,'FITLINK');p('Cover',5,6,date)
p('Cover',6,2,'FITLINK-UT-20261007');p('Cover',6,6,'1.0')
for c,v in enumerate([date,'1.0','Unit test results','A','24 cases: 9 Passed, 5 Failed, 10 Untested','testcase-jest-results.json'],1):p('Cover',11,c,v)
p('Functions',4,5,'FitLink Backend');p('Functions',5,5,'FITLINK')
p('Functions',6,5,'Not specified')
p('Functions',7,5,'Windows; Node.js 24; Jest; Babel; isolated mocked dependencies. No real payment/email/database writes. Invalid-date probe timeout: 1500 ms.')
groups=[('AUTH','Authentication','Function 1',6,0,2,['N','A','A','N','A','N','A','A']),('BOOK','Booking','Function 2',2,1,5,['N','A','A','N','N','A','N','A']),('SCH','Schedule','Function3',1,4,3,['N','A','B','A','B','N','A','A'])]
for i,(code,name,sheet,passed,failed,pending,types) in enumerate(groups):
    for col,val in enumerate([i+1,name,name+' controllers/services',name,code,sheet,'See Case Details for inputs, expected and actual results','Mocked fixtures; see per-case prerequisites'],1):p('Functions',11+i,col,val)
    old=book.sheet_by_name(sheet)
    for r in range(8,old.nrows):
        for c in range(old.ncols):put(sheet,r,c,'')
    for row,col,value in [(2,3,code),(2,12,name),(3,3,'FitLink testcase report'),(3,12,'Codex / Jest'),(4,3,'Not measured'),(4,12,'Not specified'),(5,3,'8 cases; P=Passed, F=Failed, U=Untested. Full evidence and limitations: Case Details.'),(7,1,passed),(7,3,failed),(7,6,pending),(7,15,8),(7,12,types.count('N')),(7,13,types.count('A')),(7,14,types.count('B'))]:p(sheet,row,col,value)
    for row,col,val in [(10,1,'Condition'),(11,4,'Prerequisite'),(14,2,'Test case'),(18,2,'Procedure'),(22,2,'Expected'),(31,1,'Confirm'),(34,2,'Actual / limitation'),(39,1,'Result'),(39,2,'Type (N/A/B)'),(40,2,'Passed / Failed / Untested'),(41,2,'Executed Date'),(42,2,'Defect ID')]:p(sheet,row,col,val)
    ws=out.get_sheet(book.sheet_names().index(sheet))
    for row,height in [(10,1000),(14,1500),(18,2200),(22,2400),(34,2600)]:ws.row(row).height=height;ws.row(row).height_mismatch=True
    for j,case in enumerate([c for c in cases if c['A'].startswith('TC_'+code)]):
        col=6+j;key=case['A'];res=results[key]
        for row,val in [(9,key),(11,case['E']),(15,case['B']),(19,case['C']),(23,case['D']),(35,res['note']),(39,types[j]),(40,{'Passed':'P','Failed':'F','Pending':'U'}[res['status']]),(41,date if res['status']!='Pending' else ''),(42,'DEF-'+key if res['status']=='Failed' else '')]:p(sheet,row,col,val)
        ws.col(col-1).width=8500
    for col,val in enumerate([i+1,code,passed,failed,pending,types.count('N'),types.count('A'),types.count('B'),8],1):p('Statistics',12+i,col,val)
for row,col,val in [(4,2,'FitLink Backend'),(4,6,'Codex / Jest'),(5,2,'FITLINK'),(5,6,'Not reviewed'),(6,2,'FITLINK-UT-20261007'),(6,6,date),(7,2,'Unit tests with mocks. Untested is not Passed. Execution coverage is not source-code coverage; see Case Details.'),(17,3,9),(17,4,5),(17,5,10),(17,6,9),(17,7,13),(17,8,2),(17,9,24),(19,2,'Execution coverage'),(19,4,round(14/24*100,2)),(20,2,'Passed / total cases'),(20,4,37.5),(21,4,37.5),(22,4,round(13/24*100,2)),(23,4,round(2/24*100,2))]:p('Statistics',row,col,val)
detail=out.add_sheet('Case Details')
header=xlwt.easyxf('font: bold on, colour white; pattern: pattern solid, fore_colour dark_blue; alignment: wrap on, vert top')
style=xlwt.easyxf('alignment: wrap on, vert top; borders: bottom thin')
headers=['Test Case ID','Description','Procedure','Expected Result','Precondition','Result','Actual Result / Reason / Limitation','Executed Date','Defect ID']
for c,label in enumerate(headers):detail.write(0,c,label,header);detail.col(c).width=[5000,11000,14000,14000,10000,4200,19000,7000,6500][c]
for r,case in enumerate(cases,1):
    key=case['A'];res=results[key]
    values=[key,case['B'],case['C'],case['D'],case['E'],{'Passed':'Đạt','Failed':'Không đạt','Pending':'Chưa đủ điều kiện / chưa kiểm thử'}[res['status']],res['note'],date if res['status']!='Pending' else '', 'DEF-'+key if res['status']=='Failed' else '']
    for c,value in enumerate(values):detail.write(r,c,value,style)
    detail.row(r).height=2200;detail.row(r).height_mismatch=True
detail.panes_frozen=True;detail.horz_split_pos=1
evidence=out.add_sheet('Execution Evidence')
notes=[['Execution date',date],['Command','npm.cmd run test:report'],['Raw result','testcase-jest-results.json'],['Scope','24 mapped unit cases; mocked controller/service/middleware dependencies. Not an end-to-end browser demo.'],['Summary','9 Passed; 5 Failed; 10 Untested (Jest todo)'],['Exit code','1 because five assertions failed'],['AUTH004/005 adaptation','Application uses phone/password and HttpOnly cookies; original email-login testcase was adapted.'],['AUTH002 limitation','Validation middleware tested in isolation; registration route wiring not verified.'],['SCH002 safety','Malformed-date check terminated after 1500 ms; real server was not sent this request.'],['SCH005 limitation','Overlapping request fails its expected rejection assertion; adjacent-range subcase not reached.'],['Untested','AUTH001 email confirmation lifecycle; AUTH006 profile case not mapped; BOOK004-008 missing matching read/update/cancel contract; SCH006-008 missing matching time-read/update contract.'],['Template','Guideline and Example are reference samples only; excluded from reported counts.'],['Classification','N/A/B are representative per-case categories; cases may contain multiple subcases.'],['Original preserved',str(source)]]
for r,row in enumerate(notes):
    for c,value in enumerate(row):evidence.write(r,c,value,style)
    evidence.row(r).height=1000;evidence.row(r).height_mismatch=True
evidence.col(0).width=8000;evidence.col(1).width=28000
target=root/'FitLink_Unit_Test_Template_Completed.xls'
out.save(str(target))
check=xlrd.open_workbook(str(target))
assert check.sheet_by_name('Case Details').nrows==25
assert [check.sheet_by_name('Statistics').cell_value(16,c) for c in [2,3,4,8]]==[9,5,10,24]
for _,_,s,_,_,_,_ in groups:
    assert sum(check.sheet_by_name(s).cell_value(8,c).startswith('TC_') for c in range(5,13))==8
print(target)
print('Validated: 24 cases; 9 passed; 5 failed; 10 untested. Original preserved.')
