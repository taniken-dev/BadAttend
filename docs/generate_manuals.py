"""
BadAttend 役職別マニュアル生成スクリプト
"""
from docx import Document
from docx.shared import Pt, RGBColor, Cm, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import os

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ============================================================
# ヘルパー関数
# ============================================================

def set_cell_bg(cell, hex_color):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), hex_color)
    tcPr.append(shd)

def add_heading(doc, text, level=1, color=None):
    p = doc.add_heading(text, level=level)
    if color:
        for run in p.runs:
            run.font.color.rgb = RGBColor(*bytes.fromhex(color))
    return p

def add_info_box(doc, text, bg_hex='E8F4FD', border_color='2196F3'):
    """情報ボックス（枠付き段落）"""
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    # 左インデント
    p.paragraph_format.left_indent = Cm(0.5)
    p.paragraph_format.right_indent = Cm(0.5)
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(6)
    run = p.add_run(text)
    run.font.size = Pt(10.5)
    # 枠線を pPr に追加
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    for side in ['top', 'left', 'bottom', 'right']:
        bdr = OxmlElement(f'w:{side}')
        bdr.set(qn('w:val'), 'single')
        bdr.set(qn('w:sz'), '12')
        bdr.set(qn('w:space'), '4')
        bdr.set(qn('w:color'), border_color)
        pBdr.append(bdr)
    pPr.append(pBdr)
    return p

def add_step_table(doc, steps):
    """手順テーブル（番号 + 説明）"""
    table = doc.add_table(rows=1, cols=2)
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    # ヘッダー
    hdr = table.rows[0].cells
    hdr[0].text = '手順'
    hdr[1].text = '操作内容'
    set_cell_bg(hdr[0], '1565C0')
    set_cell_bg(hdr[1], '1565C0')
    for cell in hdr:
        for para in cell.paragraphs:
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in para.runs:
                run.font.bold = True
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.size = Pt(10.5)
    # 列幅
    table.columns[0].width = Cm(2.5)
    table.columns[1].width = Cm(13)

    for i, (step_title, step_desc) in enumerate(steps, 1):
        row = table.add_row().cells
        row[0].text = f'Step {i}\n{step_title}'
        row[0].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        for para in row[0].paragraphs:
            for run in para.runs:
                run.font.bold = True
                run.font.size = Pt(10)
        set_cell_bg(row[0], 'E3F2FD')
        row[1].text = step_desc
        for para in row[1].paragraphs:
            para.paragraph_format.left_indent = Cm(0.2)
            for run in para.runs:
                run.font.size = Pt(10.5)
    return table

def add_two_col_table(doc, headers, rows, header_color='1565C0'):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = 'Table Grid'
    hdr_cells = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr_cells[i].text = h
        set_cell_bg(hdr_cells[i], header_color)
        for para in hdr_cells[i].paragraphs:
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in para.runs:
                run.font.bold = True
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.size = Pt(10.5)
    for row_data in rows:
        row_cells = table.add_row().cells
        for i, val in enumerate(row_data):
            row_cells[i].text = val
            for para in row_cells[i].paragraphs:
                para.paragraph_format.left_indent = Cm(0.2)
                for run in para.runs:
                    run.font.size = Pt(10.5)
    return table

def add_bullet(doc, text, level=0):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.left_indent = Cm(0.5 + level * 0.5)
    run = p.add_run(text)
    run.font.size = Pt(10.5)
    return p

def add_body(doc, text):
    p = doc.add_paragraph(text)
    for run in p.runs:
        run.font.size = Pt(10.5)
    p.paragraph_format.space_after = Pt(4)
    return p

def add_page_break(doc):
    doc.add_page_break()

def set_doc_defaults(doc):
    style = doc.styles['Normal']
    style.font.name = 'メイリオ'
    style.font.size = Pt(10.5)
    # A4 サイズ・余白設定
    for section in doc.sections:
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)
        section.top_margin = Cm(2.0)
        section.bottom_margin = Cm(2.0)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2.5)

def add_cover(doc, title, subtitle, role_label, role_color):
    """表紙ページ"""
    # スペース
    for _ in range(6):
        doc.add_paragraph()
    # アプリ名
    app_p = doc.add_paragraph()
    app_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    app_run = app_p.add_run('BadAttend')
    app_run.font.size = Pt(28)
    app_run.font.bold = True
    app_run.font.color.rgb = RGBColor(*bytes.fromhex('1565C0'))

    # サブタイトル
    sub_p = doc.add_paragraph()
    sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_run = sub_p.add_run('バドミントン部 出欠管理システム')
    sub_run.font.size = Pt(14)
    sub_run.font.color.rgb = RGBColor(*bytes.fromhex('455A64'))

    doc.add_paragraph()

    # 役職バッジ
    badge_p = doc.add_paragraph()
    badge_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    badge_run = badge_p.add_run(f'【 {role_label} 向けマニュアル 】')
    badge_run.font.size = Pt(18)
    badge_run.font.bold = True
    badge_run.font.color.rgb = RGBColor(*bytes.fromhex(role_color))

    doc.add_paragraph()

    # タイトル
    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = title_p.add_run(title)
    title_run.font.size = Pt(16)
    title_run.font.bold = True

    doc.add_paragraph()

    # 日付
    date_p = doc.add_paragraph()
    date_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    date_run = date_p.add_run('2026年9月')
    date_run.font.size = Pt(12)
    date_run.font.color.rgb = RGBColor(*bytes.fromhex('78909C'))

    add_page_break(doc)

def add_video_box(doc, title, video_id):
    """この操作を説明した動画の案内"""
    add_info_box(doc, f'📹 動画：{title}（{video_id}.mp4）でも操作の流れを確認できます。', 'EDE7F6', '5A55A3')


def add_faq(doc, faqs, color):
    for q, a in faqs:
        p = doc.add_paragraph()
        run_q = p.add_run(q)
        run_q.font.bold = True
        run_q.font.size = Pt(11)
        run_q.font.color.rgb = RGBColor(*bytes.fromhex(color))
        p2 = doc.add_paragraph(a)
        for run in p2.runs:
            run.font.size = Pt(10.5)
        p2.paragraph_format.left_indent = Cm(0.5)
        p2.paragraph_format.space_after = Pt(8)


# 出欠連絡のルール（部員・マネージャー・顧問で共通）
REGISTRATION_RULES = [
    ['土曜 0:00 〜 火曜 23:59', 'その週の水・木・金曜の練習を登録できます（締切は火曜 23:59）'],
    ['締切後 〜 練習開始', '登録済みの人だけ、出席・遅刻→欠席への変更ができます（欠席から出席・遅刻には戻せません）'],
    ['締切後 〜 練習終了の1時間前', '登録済みの人だけ、出席→遅刻への変更（参加予定時刻の変更も）ができます（20時終了なら 19:00 まで）'],
    ['合宿・部会', 'スケジュールが公開された後いつでも登録できます'],
    ['自主練', '開始1時間前まで「参加表明」できます'],
]

# イエロー・レッドカード（部員・マネージャー・顧問で共通。何枚でレッドかは書かない）
CARD_RULES = [
    ['出欠を提出しないまま休んだ（無連絡欠席）', 'イエロー1枚（自動）'],
    ['出席・遅刻で登録したのに、連絡なく来なかった（無断キャンセル）', 'イエロー1枚（自動）'],
    ['部会の欠席など、幹部が判断したもの', 'イエロー1枚（マネージャー・管理者が理由を書いて付ける）'],
    ['提出して欠席を連絡した', 'イエローにはならない'],
    ['欠席を連絡していても、通常の練習を長く休み続けた', 'レッド1枚（自動）'],
]

STATUS_ROWS = [
    ['出席', '練習に参加する', '1回'],
    ['遅刻', '遅れて参加する（参加予定時刻を30分刻みで選ぶ。練習終了の1時間前まで、理由が授業なら30分前まで）', '0.5回'],
    ['欠席', '練習を休む（理由を選ぶ）', '0回'],
    ['当日欠席', '練習当日の開始前に欠席を連絡したとき自動でこの扱いになる。LINEグループに通知される', '0回'],
    ['無連絡欠席', '締切までに出欠を提出しなかったとき、実績の確定時に記録される', '0回'],
]


# ============================================================
# 1. 部員（member）マニュアル
# ============================================================
def create_member_manual():
    doc = Document()
    set_doc_defaults(doc)
    add_cover(doc,
              'はじめてでもわかる！出欠連絡マニュアル',
              'バドミントン部 出欠管理システム',
              '部員', '1565C0')

    add_heading(doc, '目次', level=1)
    toc_items = [
        '1. このアプリでできること',
        '2. はじめてログインする',
        '3. ホーム画面の見かた',
        '4. 出欠連絡のルール（最も重要！）',
        '5. 出欠連絡のしかた',
        '6. 連絡した内容を変更する・当日に休むとき',
        '7. 出欠ステータスと出席率',
        '8. カレンダーの見かた・自主練',
        '9. 匿名で意見を送る（意見箱）',
        '10. その他の機能',
        '11. よくある質問（FAQ）',
    ]
    for item in toc_items:
        add_bullet(doc, item)
    add_page_break(doc)

    # ---- 1. できること ----
    add_heading(doc, '1. このアプリでできること', level=1, color='1565C0')
    add_body(doc, 'BadAttend（バドアテンド）は、千葉工業大学バドミントン部の出欠連絡と出席状況の確認をスマホやパソコンから行えるシステムです。')
    add_two_col_table(doc,
        ['機能', '説明'],
        [
            ['出欠連絡', 'カレンダーから練習日を選んで、出席・遅刻・欠席を連絡します'],
            ['ホーム', '今日の練習の参加予定者、自分の出席状況、出席率ランキングを確認できます'],
            ['カレンダー', '練習・合宿・部会・自主練・大会などの予定と、実績確定済みかどうかを月単位で確認できます'],
            ['メンバー', '部員の一覧を閲覧できます（読み取り専用）'],
            ['出欠ガイド', '出欠連絡のルールをいつでも確認できます'],
            ['ご意見箱', '部への意見・要望を匿名で送れます'],
        ]
    )
    doc.add_paragraph()

    # ---- 2. ログイン ----
    add_heading(doc, '2. はじめてログインする', level=1, color='1565C0')
    add_info_box(doc, 'ログインには LINE アカウントを使います。LINEアプリが入ったスマートフォンを用意してください。', 'FFF9C4', 'F9A825')
    doc.add_paragraph()
    add_heading(doc, '2-1. はじめてのログイン', level=2)
    add_step_table(doc, [
        ('サイトを開く', '部から案内されたURLをブラウザで開きます。'),
        ('LINEでログイン', '「LINEでログイン」ボタンをタップします。ログインすると利用規約とプライバシーポリシーに同意したものとみなされます。'),
        ('LINEで許可', 'LINEの画面でログインを許可します。'),
        ('承認待ち', '「承認待ち」画面が表示されます。管理者が承認するまで待ちます。名前はLINEの表示名で自動登録され、学年などは管理者が設定します。'),
        ('承認後', '承認されたら「ログイン画面へ」をタップするか、URLを開き直すとホーム画面に進みます（自動では切り替わりません）。'),
    ])
    doc.add_paragraph()
    add_video_box(doc, 'はじめてのログイン', 'member-login')
    add_heading(doc, '2-2. 2回目以降', level=2)
    add_body(doc, 'ログイン状態が残っていれば、URLを開くだけでホーム画面が表示されます。ブックマークやホーム画面への追加（アプリのように使えます）がおすすめです。')
    add_page_break(doc)

    # ---- 3. ホーム ----
    add_heading(doc, '3. ホーム画面の見かた', level=1, color='1565C0')
    add_two_col_table(doc,
        ['表示エリア', '内容'],
        [
            ['あなたのカード', 'イエロー・レッドカードを持っているときだけ表示。今月のイエローと、レッドの枚数が出ます'],
            ['今日の練習', '練習がある日だけ表示。「参加予定」（開始から参加・○時から参加・遅刻）と「欠席連絡あり」の人が分かります。自分がまだ連絡していなければ「出欠連絡」ボタンが出ます'],
            ['自分の出席状況', '出席率（%）と、出席・遅刻・欠席の回数。無連絡欠席があると「無断 N回」と表示されます'],
            ['直近の活動実績', '実績が確定した直近の練習の結果が色付きの丸で並びます'],
            ['出席率ランキング', '「全体」と学年ごとのタブ。全体タブは対象の練習が6回未満の人は表示されません。上位3名は表彰台に表示されます'],
        ]
    )
    doc.add_paragraph()
    add_info_box(doc, '📱 スマホでは画面下のタブ（ホーム／カレンダー／メンバー／その他）、パソコンでは画面上のメニューで移動します。', 'E8F4FD', '2196F3')
    add_video_box(doc, 'ホーム画面の見かた', 'member-home')
    add_page_break(doc)

    # ---- 4. ルール ----
    add_heading(doc, '4. 出欠連絡のルール（最も重要！）', level=1, color='D32F2F')
    add_info_box(doc, '⚠️ 締切（火曜 23:59）までに出欠を提出しなかった人は、その練習に参加できず「無連絡欠席」として記録されます。2026年9月30日の練習から、練習当日の新規登録はできません。', 'FFEBEE', 'D32F2F')
    doc.add_paragraph()
    add_two_col_table(doc, ['期間', '連絡できること'], REGISTRATION_RULES)
    doc.add_paragraph()
    add_body(doc, 'くわしいルールと次の締切は、アプリの「出欠ガイド」（スマホは「その他」→「出欠ガイド」）でいつでも確認できます。')
    doc.add_paragraph()
    add_heading(doc, 'イエロー・レッドカード', level=2)
    add_two_col_table(doc, ['こんなとき', 'カード'], CARD_RULES)
    doc.add_paragraph()
    add_bullet(doc, 'イエローは月が変わると消えます')
    add_bullet(doc, 'イエローがたまるとレッドカードになります。レッドカードは退部の対象で、理由を聞くために幹部と面談します')
    add_bullet(doc, '今持っている枚数はホーム画面の「あなたのカード」で確認できます')
    add_info_box(doc, '✅ 提出して欠席を連絡すれば、イエローにはなりません。まずは締切までに必ず提出しましょう。', 'E8F5E9', '388E3C')
    add_page_break(doc)

    # ---- 5. 出欠連絡 ----
    add_heading(doc, '5. 出欠連絡のしかた', level=1, color='1565C0')
    add_step_table(doc, [
        ('カレンダーを開く', '画面下の「カレンダー」をタップします（パソコンは上のメニュー）。'),
        ('練習日をタップ', '連絡したい練習日（色付きの丸がある日）をタップすると、下に練習の詳細が開きます。'),
        ('出欠を連絡する', '「あなたの出欠連絡」の欄にある「出欠を連絡する」をタップします。'),
        ('ステータスを選ぶ', '「出席」「遅刻」「欠席」から選びます。'),
        ('遅刻・欠席の詳細', '遅刻・欠席は理由（別練習・大会／授業／体調不良／私用／その他）を選び、内容を書きます（必須・200文字まで）。授業なら授業名を書きます。遅刻は「何時から参加予定？」で参加する時刻も選びます（練習開始の30分後から、練習終了の1時間前まで。理由が授業なら30分前まで。20時終了なら 19:00、授業なら 19:30）。書いた内容は、本人とマネージャー・管理者・顧問だけが見られます。'),
        ('連絡する', '「連絡する」をタップして完了です。登録した内容が「あなたの出欠連絡」に表示されます。'),
    ])
    doc.add_paragraph()
    add_video_box(doc, '出欠連絡のしかた', 'member-attendance')
    add_page_break(doc)

    # ---- 6. 変更 ----
    add_heading(doc, '6. 連絡した内容を変更する・当日に休むとき', level=1, color='1565C0')
    add_step_table(doc, [
        ('練習日を開く', 'カレンダーで連絡済みの練習日をタップします。'),
        ('変更', '「あなたの出欠連絡」の右上にある「変更」をタップします（「編集中」と表示されます）。'),
        ('選び直す', '新しい内容を選び、「内容を更新する」をタップします。'),
    ])
    doc.add_paragraph()
    add_two_col_table(doc,
        ['タイミング', '変更できる内容'],
        [
            ['締切まで', '自由に変更できます'],
            ['締切後 〜 練習開始', '出席・遅刻→欠席に変更できます'],
            ['締切後 〜 練習終了の1時間前', '出席→遅刻に変更できます（参加予定時刻の変更も）'],
            ['練習当日・開始前に欠席する', 'ボタンが「当日欠席として提出する」になり、「当日欠席」として記録され、LINEグループに自動で通知されます'],
            ['練習当日に遅刻する', 'LINEグループに自動で通知されます'],
            ['練習開始後に欠席する', 'できません。「欠席」を選ぶと「練習開始を過ぎたため、欠席の連絡はできません」と表示され、送信できません'],
            ['練習終了の1時間前を過ぎて遅刻する', 'できません。「遅刻」を選ぶと「練習終了の1時間前を過ぎたため、遅刻の連絡はできません」と表示され、送信できません'],
            ['練習日が過ぎた後', '変更できません'],
        ]
    )
    doc.add_paragraph()
    add_info_box(doc, '⚠️ 締切を過ぎて来なかった場合は「無断キャンセル」として記録されます。来られなくなったら、練習開始前に必ず「欠席」に変更しましょう。', 'FFEBEE', 'D32F2F')
    add_info_box(doc, '🤒 急な体調不良でも、練習開始前に必ず「欠席」に変更して連絡しましょう。無理せず休みましょう。', 'E8F5E9', '388E3C')
    add_video_box(doc, '変更と当日の欠席', 'member-change')
    add_page_break(doc)

    # ---- 7. ステータス ----
    add_heading(doc, '7. 出欠ステータスと出席率', level=1, color='1565C0')
    add_two_col_table(doc, ['ステータス', '意味', '出席率での数え方'], STATUS_ROWS)
    doc.add_paragraph()
    add_body(doc, '出席率 ＝（出席の回数 ＋ 遅刻の回数 × 0.5）÷ 対象の練習回数 × 100')
    add_bullet(doc, '対象になるのは、実績が確定した通常の練習だけです（合宿・部会・自主練・休止した練習は含みません）。')
    add_bullet(doc, '入部した日より前の練習は数えません。')
    add_bullet(doc, '実績の確定はマネージャーが行います。確定するまでランキングには反映されません。')
    add_page_break(doc)

    # ---- 8. カレンダー ----
    add_heading(doc, '8. カレンダーの見かた・自主練', level=1, color='1565C0')
    add_two_col_table(doc,
        ['表示', '意味'],
        [
            ['赤い丸', '練習日'],
            ['オレンジの丸', '合宿'],
            ['緑の丸', '部会'],
            ['紫の丸', '自主練'],
            ['青い丸・灰色の丸', '大会など・その他（表示のみ）'],
            ['緑のチェック', '実績確定済み'],
            ['「休止中」', '練習が休止になった（理由も表示されます）'],
        ]
    )
    doc.add_paragraph()
    add_body(doc, '自主練の日は「参加する」から参加表明ができます。参加する時刻を選ぶか「時間未定で参加する」を選びます。あとから「時刻を変更」「取り消す」もできます。自主練は出席率に含まれません。')
    add_page_break(doc)

    # ---- 9. 意見箱 ----
    add_heading(doc, '9. 匿名で意見を送る（意見箱）', level=1, color='1565C0')
    add_body(doc, '部への意見・要望を匿名で送れます。誰が送ったかはシステムに記録されません。')
    add_step_table(doc, [
        ('意見箱を開く', 'スマホは「その他」→「ご意見箱（匿名）」、パソコンは画面上の吹き出しアイコン（ご意見箱）をタップします。'),
        ('タイトルを入力', '件名を入力します（100文字まで）。'),
        ('内容を入力', '意見・要望を入力します（1000文字まで）。'),
        ('送信', '「送信する」をタップすると「送信しました！」と表示されます。'),
    ])
    doc.add_paragraph()
    add_video_box(doc, '意見箱で意見を送る', 'member-suggestion')
    add_page_break(doc)

    # ---- 10. その他 ----
    add_heading(doc, '10. その他の機能', level=1, color='1565C0')
    add_two_col_table(doc,
        ['機能', '場所'],
        [
            ['メンバー一覧', '画面下の「メンバー」（パソコンは「メンバー一覧」）。閲覧のみです'],
            ['出欠ガイド', 'スマホは「その他」→「出欠ガイド」、パソコンは上のメニュー'],
            ['ダークモード', 'スマホは「その他」→「ダークモード」、パソコンは歯車アイコン→「ダークモード」'],
            ['ログアウト', 'スマホは「その他」→「ログアウト」、パソコンは歯車アイコン→「ログアウト」'],
        ]
    )
    doc.add_paragraph()

    # ---- 11. FAQ ----
    add_heading(doc, '11. よくある質問（FAQ）', level=1, color='1565C0')
    add_faq(doc, [
        ('Q. 出欠の内容を間違えた！', '締切までなら「変更」から自由に直せます。締切後は、欠席への変更は練習開始まで、遅刻への変更は練習終了の1時間前までできます。それ以外の修正はマネージャーか管理者に相談してください。'),
        ('Q. 締切を過ぎて登録できない', '締切後の新規登録はできません。締切までに提出しましょう。どうしても必要な場合はマネージャーか管理者に相談してください。'),
        ('Q. 「承認待ち」のまま進めない', '管理者の承認が必要です。承認されたら「ログイン画面へ」をタップしてください。しばらく経っても進めない場合は管理者に連絡してください。'),
        ('Q. ランキングに自分が出てこない', '全体タブでは対象の練習が6回未満の人は表示されません。学年タブで確認してください。また、実績が確定するまで反映されません。'),
        ('Q. LINEログインでエラーになる', 'LINEアプリが最新か確認してください。解決しない場合は管理者に連絡してください。'),
    ], '1565C0')

    path = os.path.join(OUTPUT_DIR, '部員向けマニュアル.docx')
    doc.save(path)
    print(f'OK 部員向けマニュアル.docx を保存しました')
    return path


# ============================================================
# 2. マネージャー（manager）マニュアル
# ============================================================
def create_manager_manual():
    doc = Document()
    set_doc_defaults(doc)
    add_cover(doc,
              '出欠実績管理マニュアル',
              'バドミントン部 出欠管理システム',
              'マネージャー', '2E7D32')

    add_heading(doc, '目次', level=1)
    toc_items = [
        '1. マネージャーの役割',
        '2. 実績管理の画面を開く',
        '3. 実績の一括確定（最重要作業）',
        '4. 実績の修正と取消',
        '5. 未提出者の実績登録',
        '6. 練習の休止と解除',
        '7. 締切のお知らせ文',
        '8. 練習予定とカレンダー',
        '9. 注意事項',
    ]
    for item in toc_items:
        add_bullet(doc, item)
    add_page_break(doc)

    # ---- 1. 役割 ----
    add_heading(doc, '1. マネージャーの役割', level=1, color='2E7D32')
    add_body(doc, 'マネージャーは、部員の出欠を「実績」として確定させる役割を担います。実績が確定するとランキング（出席率）に反映されます。マネージャー自身も部員として出欠連絡をします（部員向けマニュアル参照）。')
    add_two_col_table(doc,
        ['できること', '説明'],
        [
            ['実績の確定', '練習後に、全員の出欠を実績として確定します（一括・個別）'],
            ['実績の修正・取消', '確定した実績を取り消して付け直せます'],
            ['未提出者の実績登録', '出欠を提出しなかった人の実績を個別に登録できます'],
            ['練習の休止', '台風などで練習がなくなったとき、休止にできます'],
            ['締切のお知らせ文', 'LINEグループに貼り付ける締切の案内文をコピーできます'],
        ],
        header_color='2E7D32'
    )
    doc.add_paragraph()
    add_info_box(doc, '⚠️ 部員の承認・退部処理・権限の変更、技術ランクの閲覧、意見箱の確認、運用KPIは管理者だけの機能です。', 'FFF3E0', 'F57C00')
    add_page_break(doc)

    # ---- 2. 画面 ----
    add_heading(doc, '2. 実績管理の画面を開く', level=1, color='2E7D32')
    add_body(doc, 'マネージャー用の操作は、カレンダーの練習詳細の中にあります。メニューは部員と同じです。')
    add_step_table(doc, [
        ('カレンダーを開く', '「カレンダー」をタップします。'),
        ('練習日をタップ', '確定したい練習日をタップします。'),
        ('一覧を開く', '「N/M名 連絡済み • 未提出 K名」と書かれたバーをタップすると、出欠の一覧が開きます（最初は閉じています）。'),
        ('実績管理', '一覧の上に緑の「実績管理」の欄が出ます。練習の開始時刻を過ぎてから表示されます（合宿・部会・時刻未定の練習は開始前でも表示）。'),
    ])
    doc.add_paragraph()
    add_body(doc, '一覧では「名前で絞り込み...」で検索したり、「並び替え」（出欠状況／学年／名前）で並べ替えたりできます。')
    add_page_break(doc)

    # ---- 3. 一括確定 ----
    add_heading(doc, '3. 実績の一括確定（最重要作業）', level=1, color='D32F2F')
    add_info_box(doc, '🔑 実績を確定するまでランキングに反映されません。練習が終わったらできるだけ当日中に確定してください。', 'FFEBEE', 'D32F2F')
    doc.add_paragraph()
    add_step_table(doc, [
        ('実績管理を開く', '2章の手順で「実績管理」の欄を表示します。'),
        ('内容を確認', '一覧で、実際の出欠と違う人がいないか確認します。違う人は先に4章の手順で直しておきます。'),
        ('一括確定', '「一括確定（予定N名／未提出K名は無連絡欠席）」をタップします。未提出者がいない場合や合宿・部会は「予定をそのまま実績として一括確定（N名）」になります。'),
        ('完了', '確認ダイアログは出ず、すぐに確定されます。「実績確定済み」と表示され、カレンダーの日付に緑のチェックが付きます。'),
    ])
    doc.add_paragraph()
    add_two_col_table(doc,
        ['部員の連絡', '一括確定後の実績'],
        [
            ['出席・遅刻・欠席', 'そのまま実績になります'],
            ['当日欠席', '連絡した時点ですでに実績が確定しています'],
            ['未提出（通常の練習）', '「無連絡欠席」として記録されます'],
            ['未提出（合宿・部会）', '自動では記録されません。必要なら5章の手順で個別に登録します'],
        ],
        header_color='2E7D32'
    )
    doc.add_paragraph()
    add_info_box(doc, '🟨 通常の練習で実績が「無連絡欠席」になった人には、イエローカードが自動で付きます（未提出のまま休んだ人・出席や遅刻で登録して来なかった人）。実績を直すと自動で消えます。本当の緊急で来られなかった人は「当日欠席」にすればイエローは付きません。', 'FFF8E1', 'F9A825')
    add_video_box(doc, '実績の一括確定', 'manager-confirm')
    add_page_break(doc)

    # ---- 4. 修正 ----
    add_heading(doc, '4. 実績の修正と取消', level=1, color='2E7D32')
    add_body(doc, '一覧の各行に、部員の連絡（予定）と実績が並んでいます。実績だけを直せます（部員の連絡内容そのものは変わりません）。')
    add_step_table(doc, [
        ('未確定の人を確定', '行の「実績:」から（出席／遅刻／欠席／当日欠席／無連絡欠席）を選び、「確定」をタップします。'),
        ('確定済みを直す', '行の「取消」をタップして未確定に戻し、選び直して「確定」します。'),
        ('全部やり直す', '「実績確定済み」の横の「全解除」で、その練習の実績をすべて取り消せます。'),
    ])
    doc.add_paragraph()
    add_info_box(doc, '⚠️ 1人でも確定すると、その練習全体が「確定済み」扱いになります。一部だけ確定した状態だと、実績がない人は欠席として数えられ出席率が下がるので、最後に必ず一括確定してください。取消・全解除も確認なしですぐ反映されます。', 'FFF3E0', 'F57C00')
    add_body(doc, '予定と違う実績を付けた行には「予定と実績が異なります」と表示されます。')
    add_video_box(doc, '実績の修正と取消', 'manager-fix')
    add_page_break(doc)

    # ---- 5. 未提出者 ----
    add_heading(doc, '5. 未提出者の実績登録', level=1, color='2E7D32')
    add_body(doc, '一覧の下の「未提出 N名」に、出欠を出していない人が並びます。各行でプルダウン（初期値は無連絡欠席）を選び「実績登録」をタップすると、その人の実績を登録できます。来ていた人を「出席」にしたい場合などに使います。')
    doc.add_paragraph()
    add_heading(doc, '手動でイエローを付ける（部会の欠席など）', level=2)
    add_body(doc, '部会の欠席や、幹部が判断したことは、自動ではイエローになりません。理由を問わず確認し、付けるときは手動で付けます。')
    add_step_table(doc, [
        ('練習を開く', 'カレンダーで対象の練習（部会など）を開き、実績管理の一覧を表示します。'),
        ('「＋イエロー」', '対象の人の行（未提出の人の行にもあります）で「＋イエロー」をタップします。'),
        ('理由を書いて付ける', '理由（例：部会を欠席）を入力して「付ける」をタップします。理由は必須です。'),
    ])
    doc.add_paragraph()
    add_bullet(doc, '付け間違えたときは、そのイエローの「取り消す」で取り消せます（履歴は残ります）')
    add_bullet(doc, '練習に結びつかない理由のときは、メンバー画面で部員の「カード」から付けます')
    add_bullet(doc, 'メンバー画面には、部員ごとの「連続欠席 N回」（今いくつ続けて通常練習を休んでいるか）が出ます。部員には見えません')
    add_bullet(doc, '何枚・何回でレッドになるかは部員に伝えないでください')
    add_page_break(doc)

    # ---- 6. 休止 ----
    add_heading(doc, '6. 練習の休止と解除', level=1, color='2E7D32')
    add_step_table(doc, [
        ('休止にする', '練習詳細の「練習を休止にする…」をタップします。'),
        ('理由を入力', '「理由（例: 台風）」に理由を入力し、「休止にする」をタップします。'),
        ('完了', '「休止中」と理由が表示されます。休止した練習は出欠連絡ができなくなり、出席率にも含まれません。'),
        ('解除', '「休止中」の横の「解除」で元に戻せます。'),
    ])
    doc.add_paragraph()
    add_video_box(doc, '練習の休止と解除', 'manager-cancel')
    add_page_break(doc)

    # ---- 7. お知らせ文 ----
    add_heading(doc, '7. 締切のお知らせ文', level=1, color='2E7D32')
    add_body(doc, '今日以降の通常の練習では、一覧を開くと「締切のお知らせ文」（LINEグループ貼り付け用）が使えます。')
    add_step_table(doc, [
        ('開く', '「締切のお知らせ文」をタップします。'),
        ('未提出者の名前', '締切前なら「未提出者の名前を入れる」にチェックを入れると、未提出者の名前が文に入ります。'),
        ('コピー', '「文章をコピー」をタップすると「コピーしました」と表示されます。'),
        ('貼り付け', 'LINEグループに貼り付けて送ります（アプリからは自動送信されません）。'),
    ])
    doc.add_paragraph()
    add_video_box(doc, '締切のお知らせ文', 'manager-notice')
    add_page_break(doc)

    # ---- 8. 予定 ----
    add_heading(doc, '8. 練習予定とカレンダー', level=1, color='2E7D32')
    add_bullet(doc, '練習予定は部のGoogleカレンダーから自動で取り込まれます（カレンダー画面を開いたときに同期）。アプリから練習を追加・削除することはできません。')
    add_bullet(doc, '時間・体育館の利用可能時間・面数は、Googleカレンダーの予定の説明欄（例：「時間：17:00〜20:00(22:00)」「面数：4面」）から読み取られます。')
    add_bullet(doc, 'Googleカレンダーで予定を消すと、出欠がなければ削除、出欠があれば「休止」になります。')
    add_bullet(doc, '合宿・部会・自主練は出席率に含まれません。自主練には実績管理がありません。')
    add_page_break(doc)

    # ---- 9. 注意 ----
    add_heading(doc, '9. 注意事項', level=1, color='D32F2F')
    for note in [
        '実績確定は練習終了後、できるだけ当日中に行ってください。',
        '一括確定・取消・全解除・休止には確認ダイアログがありません。押す前に対象の練習日を確認してください。',
        '無連絡欠席が自動で付くのは、通常の練習で一括確定したときだけです。',
        '部員の当日欠席・当日遅刻はLINEグループに自動通知されます。締切のお知らせ文はコピーして手動で送ります。',
        '部員は練習開始後に欠席へ、練習終了の1時間前を過ぎてから遅刻へは変更できません。本当の緊急で来られなかった人は、実績を「当日欠席」に直してください。',
        '部員の承認・退部処理・権限変更は管理者に依頼してください。',
    ]:
        add_bullet(doc, f'⚠️ {note}')

    path = os.path.join(OUTPUT_DIR, 'マネージャー向けマニュアル.docx')
    doc.save(path)
    print(f'OK マネージャー向けマニュアル.docx を保存しました')
    return path


# ============================================================
# 3. 管理者（admin）マニュアル
# ============================================================
def create_admin_manual():
    doc = Document()
    set_doc_defaults(doc)
    add_cover(doc,
              'システム管理者マニュアル',
              'バドミントン部 出欠管理システム',
              '管理者', 'B71C1C')

    add_heading(doc, '目次', level=1)
    toc_items = [
        '1. 管理者の役割と権限',
        '2. メンバー管理画面',
        '3. 新入部員の承認',
        '4. 部員情報の設定',
        '5. 退部処理',
        '6. 技術ランク',
        '7. 意見箱の確認と削除',
        '8. 提出書類の締切',
        '9. 運用KPI',
        '10. 設定・連携について',
        '11. トラブルシューティング',
    ]
    for item in toc_items:
        add_bullet(doc, item)
    add_page_break(doc)

    # ---- 1. 役割 ----
    add_heading(doc, '1. 管理者の役割と権限', level=1, color='B71C1C')
    add_body(doc, '管理者（admin）はシステム全体を管理します。マネージャーの全機能（実績確定・休止・お知らせ文など）に加えて、次の機能を使えます。')
    add_two_col_table(doc,
        ['権限', '説明'],
        [
            ['メンバー承認', '新規登録した人を承認してアプリを使えるようにします'],
            ['部員情報の設定', '表示名・学年・技術ランク・権限・入部日・幹部を設定します'],
            ['退部処理', '退部した部員を一覧から外します（データは保持）'],
            ['意見箱', '匿名で届いた意見を確認・削除します'],
            ['提出書類の締切', '部独自の書類の締切を手動で追加・編集・削除します'],
            ['運用KPI', '締切後連絡率・無連絡欠席率・提出率などの月次データを確認します'],
            ['カード', 'レッドカードを消します。カードの設定（しきい値・適用開始日）を見られます'],
        ],
        header_color='B71C1C'
    )
    doc.add_paragraph()
    add_info_box(doc, '🔐 管理者権限は最小限の人数に留めてください。', 'FFEBEE', 'D32F2F')
    add_page_break(doc)

    # ---- 2. メンバー管理 ----
    add_heading(doc, '2. メンバー管理画面', level=1, color='B71C1C')
    add_body(doc, 'スマホは画面下の「メンバー」、パソコンは上のメニューの「メンバー管理」から開きます。上から次の順に並びます。')
    add_two_col_table(doc,
        ['セクション', '内容'],
        [
            ['プロフィール未作成のユーザー', 'ログインはしたがプロフィールがない人（いるときだけ表示）'],
            ['承認待ち', '新規登録してまだ承認されていない人（いるときだけ表示）'],
            ['カードの設定', '何枚でレッドか・何回連続でレッドか・適用開始日（管理者だけに表示）'],
            ['部員一覧', '承認済みの部員。「名前で検索...」で絞り込めます。各行で情報を直接編集します。レッドカードのある人は自動で一番上に並びます'],
            ['退部済みメンバー', '退部処理した人（タップで開く・閲覧のみ）'],
        ],
        header_color='B71C1C'
    )
    doc.add_paragraph()
    add_heading(doc, 'イエロー・レッドカード', level=2)
    add_body(doc, '部員の名前の下に「レッドカード N枚」「イエロー N枚（今月）」が出ます。押すと内訳（理由・対象の練習日）が開きます。')
    add_two_col_table(doc,
        ['操作', '説明'],
        [
            ['レッドを消す', '内訳の「消す」で消します（管理者のみ）。面談などが済んだら消してください。消したレッドは「解除済み」として履歴に残り、一覧の並びも元に戻ります'],
            ['イエローを付ける', '内訳の「イエローを付ける」に理由を書いて付けます（マネージャー・管理者）。練習ごとの分はカレンダーの実績確定画面から付けます'],
            ['イエローを取り消す', '手動で付けたイエローは「取り消す」で取り消せます。自動で付いたイエローは、実績を直すと消えます'],
        ],
        header_color='B71C1C'
    )
    doc.add_paragraph()
    add_bullet(doc, 'イエローは月ごとに数え、月が変わると消えます。同じ月のイエローが一定枚数たまるたびにレッドが1枚出ます。レッドは月をまたいでも残ります')
    add_bullet(doc, '何枚でレッドか・適用開始日は、メンバー管理画面の「カードの設定」を見てください。部員には伝えないでください')
    add_bullet(doc, '通常の練習を連続で一定回数休んだ人にも、レッドが1枚出ます（連絡のある欠席も数えます。出席か遅刻で途切れます。合宿・部会・自主練・休止は数えません）。内訳には「連続欠席」と期間が出ます')
    add_bullet(doc, 'マネージャーと管理者には、部員の名前の下に「連続欠席 N回」（今いくつ続けて休んでいるか）が出ます。部員と顧問には出ません。レッドになる前に声をかけるのに使ってください')
    add_bullet(doc, '怪我や留学などで長く休む人も、欠席を提出していてもレッドになります。そのときは事情を確認してレッドを消してください')
    add_bullet(doc, 'レッドになっても退部処理は自動ではされません。理由を聞くために面談してください')
    add_page_break(doc)

    # ---- 3. 承認 ----
    add_heading(doc, '3. 新入部員の承認', level=1, color='B71C1C')
    add_info_box(doc, '📋 新入部員がLINEでログインすると「承認待ち」に表示されます。承認するまでアプリを使えないので、早めに対応してください。', 'E8F4FD', '2196F3')
    doc.add_paragraph()
    add_step_table(doc, [
        ('メンバー管理を開く', '「メンバー」（パソコンは「メンバー管理」）を開きます。'),
        ('承認待ちを確認', '「承認待ち」にLINEネームと学年が表示されます。本人確認ができた人だけ承認してください。'),
        ('承認', '「承認」をタップすると「承認しました」と表示され、本人がアプリを使えるようになります。'),
        ('学年・表示名を直す', '新規登録は1年生・技術ランク3で作られます。部員一覧で学年や表示名を正しく設定してください（4章）。'),
    ])
    doc.add_paragraph()
    add_info_box(doc, '⚠️ 「拒否」は退部処理と同じ扱いです（確認ダイアログが出て、退部済みメンバーに移ります）。', 'FFF3E0', 'F57C00')
    add_video_box(doc, '新入部員の承認', 'admin-approve')
    add_page_break(doc)

    # ---- 4. 部員情報 ----
    add_heading(doc, '4. 部員情報の設定', level=1, color='B71C1C')
    add_body(doc, '部員一覧の各行で直接変更します。変更するとすぐ保存され、画面下に「〜を更新しました」と表示されます（確認ダイアログはありません）。')
    add_two_col_table(doc,
        ['項目', '説明', '注意点'],
        [
            ['表示名', '鉛筆アイコンで編集。アプリ上に表示される名前', '未設定ならLINEネームが使われます（LINEネームはログインのたびに更新）'],
            ['学年', '1〜4年', '毎年4月に更新してください（顧問には表示されません）'],
            ['技術ランク', '1（E級）〜6（S級）、標準は3（C級）', '管理者と顧問だけが見られます'],
            ['権限', '部員／マネージャー／管理者／顧問', '自分の権限は変更できません'],
            ['入部日', '未設定なら学年から自動計算', '出席率を数え始める日になります'],
            ['幹部', 'チェックすると体育会の提出書類締切が表示されます', '締切のLINEリマインドも届きます'],
        ],
        header_color='B71C1C'
    )
    doc.add_paragraph()
    add_heading(doc, '権限ごとにできること', level=2)
    add_two_col_table(doc,
        ['権限', '主な機能'],
        [
            ['部員', '自分の出欠連絡・ホーム/カレンダー/メンバー一覧の閲覧・意見箱への投稿'],
            ['マネージャー', '部員の機能＋実績確定・修正・未提出者の実績登録・練習の休止・締切のお知らせ文・手動イエロー'],
            ['管理者', 'マネージャーの機能＋承認・部員情報の設定・退部処理・意見箱の確認/削除・提出書類の締切管理・運用KPI・レッドを消す'],
            ['顧問', '閲覧のみ（出欠連絡はできません）。技術ランクとカードの内訳も見られます'],
        ],
        header_color='B71C1C'
    )
    doc.add_paragraph()
    add_video_box(doc, '部員情報の設定', 'admin-members')
    add_page_break(doc)

    # ---- 5. 退部 ----
    add_heading(doc, '5. 退部処理', level=1, color='B71C1C')
    add_body(doc, '退部した部員は「退部処理」で一覧から外します。出席記録などのデータは消えずに保持されます。')
    add_step_table(doc, [
        ('対象を探す', '部員一覧で対象の部員を探します（「名前で検索...」が便利です）。'),
        ('退部', '行の「退部」（スマホはゴミ箱アイコン）をタップします。'),
        ('確認', '「〇〇を退部処理しますか？」と確認が出るので、OKを押します。'),
        ('完了', '「〇〇 を退部処理しました」と表示され、「退部済みメンバー」に移ります。ランキングや未提出者一覧からも外れます。'),
    ])
    doc.add_paragraph()
    add_info_box(doc, '⚠️ 自分自身と、他の管理者は退部処理できません（先に権限を変更してください）。アプリには元に戻す機能がないので、戻す場合はシステム担当に依頼してください。', 'FFF3E0', 'F57C00')
    add_video_box(doc, '退部処理', 'admin-retire')
    add_page_break(doc)

    # ---- 6. 技術ランク ----
    add_heading(doc, '6. 技術ランク', level=1, color='B71C1C')
    add_two_col_table(doc,
        ['ランク', '表示'],
        [
            ['6', 'S級'], ['5', 'A級'], ['4', 'B級'], ['3', 'C級（標準）'], ['2', 'D級'], ['1', 'E級'],
        ],
        header_color='B71C1C'
    )
    doc.add_paragraph()
    add_body(doc, '技術ランクは管理者と顧問だけがメンバー画面で見られます。ランキングは出席率だけで並び、技術ランクは使われません。')
    add_page_break(doc)

    # ---- 7. 意見箱 ----
    add_heading(doc, '7. 意見箱の確認と削除', level=1, color='B71C1C')
    add_step_table(doc, [
        ('開く', 'スマホは「その他」、パソコンは歯車アイコンから「【管理者】届いた意見を確認」をタップします。'),
        ('読む', '「意見箱の確認」に、タイトル・投稿日時・本文がすべて表示されます。'),
        ('削除', '不要な投稿はゴミ箱アイコンをタップし、確認で OK を押すと削除されます（元に戻せません）。'),
    ])
    doc.add_paragraph()
    add_info_box(doc, '🔒 送った人は記録されていません。内容から個人を特定しようとしないでください。', 'E8F5E9', '388E3C')
    add_video_box(doc, '届いた意見の確認', 'admin-suggestions')
    add_page_break(doc)

    # ---- 8. 提出書類 ----
    add_heading(doc, '8. 提出書類の締切', level=1, color='B71C1C')
    add_body(doc, 'ホームの「提出書類の締切（体育会）」カードは、管理者と幹部だけに表示されます。体育会HPの締切は毎日自動で取り込まれ、7日前・3日前・前日・当日にLINEでリマインドが届きます。')
    add_step_table(doc, [
        ('追加', 'カードの「追加」をタップし、書類名と締切日時を入力して「追加」します（HPに載らない部独自の書類用）。'),
        ('編集・削除', '手動で追加した書類（「手動」ラベル）は鉛筆アイコンで編集、ゴミ箱アイコンで削除できます。'),
        ('提出済みにする', '提出したらチェックボタン（提出しました）をタップします。'),
    ])
    doc.add_paragraph()
    add_video_box(doc, '提出書類の締切', 'admin-deadlines')
    add_page_break(doc)

    # ---- 9. KPI ----
    add_heading(doc, '9. 運用KPI', level=1, color='B71C1C')
    add_body(doc, '「【管理者】運用KPI」から、締切後連絡率・無連絡欠席率・提出率、出席率の推移、月次データを確認できます（閲覧のみ）。')
    doc.add_paragraph()

    # ---- 10. 設定・連携 ----
    add_heading(doc, '10. 設定・連携について', level=1, color='B71C1C')
    add_two_col_table(doc,
        ['項目', '内容'],
        [
            ['練習予定', 'Googleカレンダーから自動で取り込まれます。予定の追加・変更はGoogleカレンダー側で行います'],
            ['出欠のルール', '2026年9月30日の練習から「土〜火に登録・当日の新規登録不可」のルールが適用されています。締切後の欠席は練習開始まで、遅刻は練習終了の1時間前まで（時刻はGoogleカレンダーの各練習の時間から決まります）。変更はアプリの画面からはできません（システム担当がデータベースで設定）'],
            ['LINEグループ通知', '部員の当日欠席・当日遅刻・締切後の欠席連絡が自動で通知されます'],
            ['イエロー・レッドカード', '自動で付きます。しきい値と適用開始日はメンバー管理画面の「カードの設定」で見られます。変更はアプリの画面からはできません（システム担当がデータベースで設定）'],
        ],
        header_color='B71C1C'
    )
    doc.add_paragraph()

    # ---- 11. トラブル ----
    add_heading(doc, '11. トラブルシューティング', level=1, color='B71C1C')
    add_faq(doc, [
        ('Q. 部員が「承認待ち」から進めない', 'メンバー管理の「承認待ち」で「承認」してください。承認後、本人に「ログイン画面へ」をタップしてもらいます。'),
        ('Q. ランキングが更新されない', '実績が確定されていない可能性があります。カレンダーで未確定の練習日を確認してください。また、全体タブは対象の練習が6回未満の人を表示しません。'),
        ('Q. 部員がログインできない', 'LINEアプリが最新か確認してもらってください。解決しない場合は、LINE Developers のチャネル設定とサーバーの環境変数（LINE_CLIENT_ID / LINE_CLIENT_SECRET）をシステム担当が確認します。'),
        ('Q. 締切後に登録したいと言われた', '部員本人は締切後に新規登録できません。必要ならマネージャー・管理者が実績を登録してください。'),
        ('Q. 提出書類が「未取得」になっている', '体育会HPとの同期に失敗しています。体育会HPを直接確認してください。'),
    ], 'B71C1C')

    path = os.path.join(OUTPUT_DIR, '管理者向けマニュアル.docx')
    doc.save(path)
    print(f'OK 管理者向けマニュアル.docx を保存しました')
    return path


# ============================================================
# 4. 顧問（coach）マニュアル
# ============================================================
def create_coach_manual():
    doc = Document()
    set_doc_defaults(doc)
    add_cover(doc,
              '顧問向け閲覧マニュアル',
              'バドミントン部 出欠管理システム',
              '顧問', '4A148C')

    add_heading(doc, '目次', level=1)
    for item in ['1. 顧問アカウントについて', '2. ログイン方法', '3. 閲覧できる情報', '4. 注意事項']:
        add_bullet(doc, item)
    add_page_break(doc)

    # ---- 1. 顧問について ----
    add_heading(doc, '1. 顧問アカウントについて', level=1, color='4A148C')
    add_body(doc, '顧問アカウントは、部の活動状況を把握するための閲覧用アカウントです。')
    add_info_box(doc, '📌 出欠連絡・データの変更・部員管理はできません。閲覧が中心です（意見箱への投稿とダークモードの切り替えはできます）。', 'EDE7F6', '7B1FA2')
    doc.add_paragraph()
    add_two_col_table(doc,
        ['できること', 'できないこと'],
        [
            ['今日の練習の参加予定者・欠席者の確認', '出欠連絡'],
            ['出席率ランキングの確認', '出欠・実績の変更'],
            ['カレンダーと各練習の出欠一覧の確認', '部員の承認・退部処理・情報の変更'],
            ['メンバー一覧（技術ランクを含む）の閲覧', '意見箱の閲覧'],
            ['意見箱への投稿', '運用KPIの閲覧'],
        ],
        header_color='4A148C'
    )
    add_page_break(doc)

    # ---- 2. ログイン ----
    add_heading(doc, '2. ログイン方法', level=1, color='4A148C')
    add_info_box(doc, 'ログインには LINE アカウントを使います。', 'EDE7F6', '7B1FA2')
    doc.add_paragraph()
    add_step_table(doc, [
        ('サイトを開く', '部から案内されたURLをブラウザで開きます（ブックマーク推奨）。'),
        ('LINEでログイン', '「LINEでログイン」をタップし、LINEの画面で許可します。'),
        ('はじめての場合', '「承認待ち」画面になります。部の管理者が承認し、権限を「顧問」に設定するまでお待ちください。'),
        ('利用開始', '承認後「ログイン画面へ」をタップするか、URLを開き直すとホーム画面が表示されます。'),
    ])
    doc.add_paragraph()
    add_info_box(doc, 'ログインできない場合は部の管理者（部長）にお問い合わせください。', 'EDE7F6', '7B1FA2')
    add_page_break(doc)

    # ---- 3. 閲覧 ----
    add_heading(doc, '3. 閲覧できる情報', level=1, color='4A148C')
    add_heading(doc, '3-1. ホーム画面', level=2)
    add_bullet(doc, '今日の練習：参加予定の部員（開始から参加・○時から参加・遅刻）と欠席連絡のあった部員（理由つき）')
    add_bullet(doc, '出席率ランキング：「全体」と学年ごとのタブ、上位3名の表彰台、各部員の出席率と出席・遅刻・欠席の回数')
    doc.add_paragraph()
    add_heading(doc, '3-2. カレンダー画面', level=2)
    add_bullet(doc, '練習日・合宿・部会・自主練・大会などの予定（色付きの丸）')
    add_bullet(doc, '日付をタップ → 「N/M名 連絡済み • 未提出 K名」のバーをタップすると、各部員の出欠と理由の一覧が開きます')
    add_bullet(doc, '「実績確定済み」（緑のチェック）、「休止中」（理由つき）の表示')
    add_video_box(doc, 'カレンダーで出欠を見る', 'coach-calendar')
    doc.add_paragraph()
    add_heading(doc, '3-3. メンバー一覧', level=2)
    add_bullet(doc, '名前・学年・権限・技術ランク（E級〜S級）・幹部の表示。「名前で検索...」で絞り込めます')
    add_bullet(doc, 'イエロー・レッドカードの枚数。押すと内訳（理由・対象の練習日）が開きます（閲覧のみ）。レッドカードのある人は一番上に並びます')
    doc.add_paragraph()
    add_heading(doc, '3-4. 出席率について', level=2)
    add_body(doc, '出席率 ＝（出席 ＋ 遅刻 × 0.5）÷ 実績が確定した通常の練習の回数 × 100。合宿・部会・自主練・休止した練習は含みません。')
    add_page_break(doc)

    # ---- 4. 注意 ----
    add_heading(doc, '4. 注意事項', level=1, color='4A148C')
    for note in [
        '閲覧した部員情報は部外秘です。外部に漏らさないよう管理してください。',
        '出席率ランキングは参考指標です。選考などは顧問・部員で話し合って決めてください。',
        '共用のパソコンでは、使い終わったら「ログアウト」してください（スマホは「その他」、パソコンは歯車アイコン）。',
        'わからないことがあれば、部の管理者（部長）にお問い合わせください。',
    ]:
        add_bullet(doc, f'✅ {note}')

    path = os.path.join(OUTPUT_DIR, '顧問向けマニュアル.docx')
    doc.save(path)
    print(f'OK 顧問向けマニュアル.docx を保存しました')
    return path


# ============================================================
# メイン
# ============================================================
if __name__ == '__main__':
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    create_member_manual()
    create_manager_manual()
    create_admin_manual()
    create_coach_manual()
    print('\n🎉 全マニュアルの生成が完了しました！')
    print(f'保存先: {OUTPUT_DIR}')
