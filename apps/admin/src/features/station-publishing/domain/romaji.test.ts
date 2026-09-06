import { describe, it, expect } from 'vitest';
import { hepburn } from './romaji';

// 実在する駅コードを添えているケースは、駅データ.jp 会員版CSV
// （station20260731.csv）の該当行を実際に確認したものである。
// リポジトリにCSV自体は含めず、必要な列のみを固定データとして埋め込む
// （ekidata 利用規約に由来する制約。docs/domain/station-master-model.md
//  「利用規約に由来する制約」）。

describe('hepburn: 決定的規則', () => {
  it('ヂ/ヅ → ji/zu（お花茶屋 2300108 / 国府津 1130114）', () => {
    expect(hepburn('オハナヂャヤ')).toBe('ohanajaya');
    expect(hepburn('コウヅ')).toBe('kozu');
  });

  it('シ/チ/ツ/フ/ジ はワープロ式（si/ti/tu/hu）を採らない', () => {
    expect(hepburn('シチツフジ')).toBe('shichitsufuji');
  });

  it('促音（ッ）は次の子音を重ねる。ch の前は t（倶知安 1110211）', () => {
    expect(hepburn('クッチャン')).toBe('kutchan');
  });

  it('促音は ch 以外の子音もそのまま重ねる（日暮里 1130218 / 別府 1190640）', () => {
    expect(hepburn('ニッポリ')).toBe('nippori');
    expect(hepburn('ベップ')).toBe('beppu');
  });

  it('末尾の促音（次のモーラが無い）は無音として捨てる（境界条件）', () => {
    expect(hepburn('アッ')).toBe('a');
    expect(hepburn('ッ')).toBe('');
  });

  it('拗音・外来音（新宿三丁目 相当のカナ）', () => {
    expect(hepburn('シンジュクサンチョウメ')).toBe('shinjukusanchome');
  });

  it('ー（長音記号）は削除する（ガーラ湯沢 100602）', () => {
    expect(hepburn('ガーラユザワ')).toBe('garayuzawa');
  });

  it('ジェイアール → jr（置換辞書。JR総持寺 1160217 ほか実測13駅）', () => {
    expect(hepburn('ジェイアールソウジジ')).toBe('jr-sojiji');
  });

  it('ジェイアールのみの場合は jr（残余が空文字）', () => {
    expect(hepburn('ジェイアール')).toBe('jr');
  });
});

describe('hepburn: 長音の縮約（方針）', () => {
  it('お段+ウ / お段+オ は縮約する（東京 100201 / 大阪の実例相当）', () => {
    expect(hepburn('トウキョウ')).toBe('tokyo');
    expect(hepburn('オオサカ')).toBe('osaka');
  });

  it('お段以外（あ/い/う/え段）は縮約しない（新潟 100512 / 大成 100706 / 新岩国 100313）', () => {
    expect(hepburn('ニイガタ')).toBe('niigata');
    expect(hepburn('タイセイ')).toBe('taisei');
    expect(hepburn('シンイワクニ')).toBe('shiniwakuni');
  });

  it('撥音を挟むと縮約しない（[お段]+ン+オ／ウ、本大久保 京成本線）', () => {
    expect(hepburn('ホンオオクボ')).toBe('honokubo');
  });
});

describe('hepburn: 方針として決めるもの', () => {
  it('撥音の m 化はしない（コウエンマエ→koenmae）', () => {
    expect(hepburn('コウエンマエ')).toBe('koenmae');
  });

  it('ン＋母音にアポストロフィを入れない（シンオオサカ→shinosaka）', () => {
    expect(hepburn('シンオオサカ')).toBe('shinosaka');
  });
});

describe('hepburn: 原理的に決まらないもの（既知の不一致として明示的に許容する）', () => {
  // docs/domain/station-master-model.md「slug の導出規則」— 形態素境界の母音連続は
  // カナだけからは判別不能で、既知の不一致として許容する。
  // ここでは「誤り側」を期待値として固定し、後から形態素解析器を
  // 導入したくなる圧力そのものを可視化する。

  it('武雄温泉（タケオ+オンセン、正: takeo-onsen。101201/1191805）', () => {
    expect(hepburn('タケオオンセン')).toBe('takeonsen');
  });

  it('嬉野温泉（ウレシノ+オンセン、正: ureshino-onsen。101202）', () => {
    expect(hepburn('ウレシノオンセン')).toBe('ureshinonsen');
  });

  it('てだこ浦西（テダコ+ウラニシ、正: tedako-uranishi。9992719）', () => {
    expect(hepburn('テダコウラニシ')).toBe('tedakoranishi');
  });

  it('えちご押上ひすい海岸（エチゴ+オシアゲ、正: echigo-oshiage-hisuikaigan。9942302）', () => {
    expect(hepburn('エチゴオシアゲヒスイカイガン')).toBe('echigoshiagehisuikaigan');
  });

  it('小海（コ+ウミ、正: koumi。1140111）', () => {
    expect(hepburn('コウミ')).toBe('komi');
  });
});

describe('hepburn: カナ欠陥9駅は末尾のエキ等を機械的に落とさない', () => {
  // カナ側の欠陥（漢字名に無い「駅」がカナにだけ付く行）。末尾の「エキ」を落とすと
  // 家城（イエキ）・植木（ウエキ）を巻き添えにするため、romaji.ts は正規化を行わない。
  // 公開時の確認UI（slugCandidate.ts の hasKanaEkiSuffixMismatch）で拾う。
  it('天童南（テンドウミナミエキ。1121636）は エキ を含んだまま変換する', () => {
    expect(hepburn('テンドウミナミエキ')).toBe('tendominamieki');
  });

  it('家城（イエキ。1151310）と植木（ウエキ。1190337）は正当な駅名として変換する', () => {
    expect(hepburn('イエキ')).toBe('ieki');
    expect(hepburn('ウエキ')).toBe('ueki');
  });
});

// --- 回帰用の固定データ ---
//
// 駅データ.jp 会員版CSV（station20260731.csv、本セッションで参照）の現役10,625駅から、
// 本モジュールの変換結果が公式の英語表記（station_name_r）と実質一致する155件を
// 固定データとして持つ（大文字・記号の差異のみを許容して照合。ハイフンや空白は
// 複合地名の区切りを示す表記上の違いであり、slug がハイフンで単語を分割しない
// 本実装の方針とは無関係である）。
//
// 【この155件は独立に実測し直したもの】
// 変換規則の検討時に引用されていた「186件・正解率85.9%」は対象の駅一覧が
// 記録に残っておらず再現できないため、会員版CSV から独立に測り直した。
// station_name_r（公式英語表記列）は全体として
// 単一の規則に従っておらず（大文字・ハイフン区切りの公式表記が付く駅がある一方、
// 撥音を "nn" と重ねる・長音を縮約しない等、素朴な機械転写のみの駅が多数を占める）、
// 全10,625件に対する単純な完全一致率は指標として意味を持たない。ここでは
// 「公式表記が付与されている（大文字始まり・ハイフン・空白のいずれかを含む）」
// 駅398件から、明らかな英訳（例: "City Hall"、"Peace Park"）48件を除いた350件のうち、
// 本モジュールの出力と大文字・記号を除いて完全一致した155件（重複除去後）を採用した。
const FIXTURE: { name: string; kana: string; expected: string }[] = [
  { name: '岐阜羽島', kana: 'ギフハシマ', expected: 'gifuhashima' },
  { name: '新尾道', kana: 'シンオノミチ', expected: 'shinonomichi' },
  { name: '東広島', kana: 'ヒガシヒロシマ', expected: 'higashihiroshima' },
  { name: '新岩国', kana: 'シンイワクニ', expected: 'shiniwakuni' },
  { name: '小倉', kana: 'コクラ', expected: 'kokura' },
  { name: '白石蔵王', kana: 'シロイシザオウ', expected: 'shiroishizao' },
  { name: 'くりこま高原', kana: 'クリコマコウゲン', expected: 'kurikomakogen' },
  { name: '水沢江刺', kana: 'ミズサワエサシ', expected: 'mizusawaesashi' },
  { name: '七戸十和田', kana: 'シチノヘトワダ', expected: 'shichinohetowada' },
  { name: '新青森', kana: 'シンアオモリ', expected: 'shinaomori' },
  { name: '本庄早稲田', kana: 'ホンジョウワセダ', expected: 'honjowaseda' },
  { name: '上毛高原', kana: 'ジョウモウコウゲン', expected: 'jomokogen' },
  { name: '安中榛名', kana: 'アンナカハルナ', expected: 'annakaharuna' },
  { name: '黒部宇奈月温泉', kana: 'クロベウナヅキオンセン', expected: 'kurobeunazukionsen' },
  { name: '新高岡', kana: 'シンタカオカ', expected: 'shintakaoka' },
  { name: '芦原温泉', kana: 'アワラオンセン', expected: 'awaraonsen' },
  { name: '越前たけふ', kana: 'エチゼンタケフ', expected: 'echizentakefu' },
  { name: '新鳥栖', kana: 'シントス', expected: 'shintosu' },
  { name: '新大牟田', kana: 'シンオオムタ', expected: 'shinomuta' },
  { name: '新玉名', kana: 'シンタマナ', expected: 'shintamana' },
  { name: '川内', kana: 'センダイ', expected: 'sendai' },
  { name: '奥津軽いまべつ', kana: 'オクツガルイマベツ', expected: 'okutsugaruimabetsu' },
  { name: '新函館北斗', kana: 'シンハコダテホクト', expected: 'shinhakodatehokuto' },
  { name: '新大村', kana: 'シンオオムラ', expected: 'shinomura' },
  { name: '泉外旭川', kana: 'イズミソトアサヒカワ', expected: 'izumisotoasahikawa' },
  { name: '北金ケ沢', kana: 'キタカネガサワ', expected: 'kitakanegasawa' },
  { name: '前潟', kana: 'マエガタ', expected: 'maegata' },
  { name: '石巻あゆみ野', kana: 'イシノマキアユミノ', expected: 'ishinomakiayumino' },
  { name: '小田栄', kana: 'オダサカエ', expected: 'odasakae' },
  { name: '西府', kana: 'ニシフ', expected: 'nishifu' },
  { name: '北茅ケ崎', kana: 'キタチガサキ', expected: 'kitachigasaki' },
  { name: '幕張豊砂', kana: 'マクハリトヨスナ', expected: 'makuharitoyosuna' },
  { name: '南大高', kana: 'ミナミオオダカ', expected: 'minamiodaka' },
  { name: '摩耶', kana: 'マヤ', expected: 'maya' },
  { name: '東姫路', kana: 'ヒガシヒメジ', expected: 'higashihimeji' },
  { name: '寺家', kana: 'ジケ', expected: 'jike' },
  { name: '新白島', kana: 'シンハクシマ', expected: 'shinhakushima' },
  { name: '寝屋川公園', kana: 'ネヤガワコウエン', expected: 'neyagawakoen' },
  { name: '広川ビーチ', kana: 'ヒロカワビーチ', expected: 'hirokawabichi' },
  { name: '南吹田', kana: 'ミナミスイタ', expected: 'minamisuita' },
  { name: '城北公園通', kana: 'シロキタコウエンドオリ', expected: 'shirokitakoendori' },
  { name: '衣摺加美北', kana: 'キズリカミキタ', expected: 'kizurikamikita' },
  { name: '呉ポートピア', kana: 'クレポートピア', expected: 'kurepotopia' },
  { name: '河戸帆待川', kana: 'コウドホマチガワ', expected: 'kodohomachigawa' },
  { name: 'あき亀山', kana: 'アキカメヤマ', expected: 'akikameyama' },
  { name: '南伊予', kana: 'ミナミイヨ', expected: 'minamiiyo' },
  { name: 'スペースワールド', kana: 'スペースワールド', expected: 'supesuwarudo' },
  { name: '西熊本', kana: 'ニシクマモト', expected: 'nishikumamoto' },
  { name: '吉野ケ里公園', kana: 'ヨシノガリコウエン', expected: 'yoshinogarikoen' },
  { name: '糸島高校前', kana: 'イトシマコウコウマエ', expected: 'itoshimakokomae' },
  { name: '久留米高校前', kana: 'クルメコウコウマエ', expected: 'kurumekokomae' },
  { name: 'みなみ寄居', kana: 'ミナミヨリイ', expected: 'minamiyorii' },
  { name: '獨協大学前〈草加松原〉', kana: 'ドッキョウダイガクマエ　ソウカマツバラ', expected: 'dokkyodaigakumaesokamatsubara' },
  { name: 'ユーカリが丘', kana: 'ユーカリガオカ', expected: 'yukarigaoka' },
  { name: '聖蹟桜ヶ丘', kana: 'セイセキサクラガオカ', expected: 'seisekisakuragaoka' },
  { name: '新線新宿', kana: 'シンセンシンジュク', expected: 'shinsenshinjuku' },
  { name: '祖師ヶ谷大蔵', kana: 'ソシガヤオオクラ', expected: 'soshigayaokura' },
  { name: '新百合ヶ丘', kana: 'シンユリガオカ', expected: 'shinyurigaoka' },
  { name: 'たまプラーザ', kana: 'タマプラーザ', expected: 'tamapuraza' },
  { name: '新綱島', kana: 'シンツナシマ', expected: 'shintsunashima' },
  { name: '逗子・葉山', kana: 'ズシ・ハヤマ', expected: 'zushihayama' },
  { name: 'ＹＲＰ野比', kana: 'ワイアールピーノビ', expected: 'waiarupinobi' },
  { name: '加木屋中ノ池', kana: 'カギヤナカノイケ', expected: 'kagiyanakanoike' },
  { name: '祇園四条', kana: 'ギオンシジョウ', expected: 'gionshijo' },
  { name: '清水五条', kana: 'キヨミズゴジョウ', expected: 'kiyomizugojo' },
  { name: 'びわ湖浜大津', kana: 'ビワコハマオオツ', expected: 'biwakohamaotsu' },
  { name: '大津市役所前', kana: 'オオツシヤクショマエ', expected: 'otsushiyakushomae' },
  { name: '京阪大津京', kana: 'ケイハンオオツキョウ', expected: 'keihanotsukyo' },
  { name: '坂本比叡山口', kana: 'サカモトヒエイザングチ', expected: 'sakamotohieizanguchi' },
  { name: '大阪梅田', kana: 'オオサカウメダ', expected: 'osakaumeda' },
  { name: '服部天神', kana: 'ハットリテンジン', expected: 'hattoritenjin' },
  { name: '石橋阪大前', kana: 'イシバシハンダイマエ', expected: 'ishibashihandaimae' },
  { name: '中山観音', kana: 'ナカヤマカンノン', expected: 'nakayamakannon' },
  { name: '西山天王山', kana: 'ニシヤマテンノウザン', expected: 'nishiyamatennozan' },
  { name: '松尾大社', kana: 'マツオタイシャ', expected: 'matsuotaisha' },
  { name: '鳴尾・武庫川女子大前', kana: 'ナルオムコガワジョシダイマエ', expected: 'naruomukogawajoshidaimae' },
  { name: '西鉄福岡（天神）', kana: 'フクオカ（テンジン）', expected: 'fukuokatenjin' },
  { name: '桜並木', kana: 'サクラナミキ', expected: 'sakuranamiki' },
  { name: 'ロープウェイ入口', kana: 'ロープウェイイリグチ', expected: 'ropuweiiriguchi' },
  { name: '狸小路', kana: 'タヌキコウジ', expected: 'tanukikoji' },
  { name: '石川プール前', kana: 'イシカワプールマエ', expected: 'ishikawapurumae' },
  { name: '弘前学院大前', kana: 'ヒロサキガクインダイマエ', expected: 'hirosakigakuindaimae' },
  { name: '新田老', kana: 'シンタロウ', expected: 'shintaro' },
  { name: '十府ヶ浦海岸', kana: 'トフガウラカイガン', expected: 'tofugaurakaigan' },
  { name: '七ヶ岳登山口', kana: 'ナナツガタケトザングチ', expected: 'nanatsugataketozanguchi' },
  { name: '青葉山', kana: 'アオバヤマ', expected: 'aobayama' },
  { name: '川内', kana: 'カワウチ', expected: 'kawauchi' },
  { name: '大町西公園', kana: 'オオマチニシコウエン', expected: 'omachinishikoen' },
  { name: '青葉通一番町', kana: 'アオバドオリイチバンチョウ', expected: 'aobadoriichibancho' },
  { name: '宮城野通', kana: 'ミヤギノドオリ', expected: 'miyaginodori' },
  { name: '六丁の目', kana: 'ロクチョウノメ', expected: 'rokuchonome' },
  { name: '都電雑司ヶ谷', kana: 'トデンゾウシガヤ', expected: 'todenzoshigaya' },
  { name: 'ふかや花園', kana: 'フカヤハナゾノ', expected: 'fukayahanazono' },
  { name: '美乃浜学園', kana: 'ミノハマガクエン', expected: 'minohamagakuen' },
  { name: '高田の鉄橋', kana: 'タカダノテッキョウ', expected: 'takadanotekkyo' },
  { name: '佐野のわたし', kana: 'サノノワタシ', expected: 'sanonowatashi' },
  { name: '品川シーサイド', kana: 'シナガワシーサイド', expected: 'shinagawashisaido' },
  { name: '公園下', kana: 'コウエンシモ', expected: 'koenshimo' },
  { name: '公園上', kana: 'コウエンカミ', expected: 'koenkami' },
  { name: '中強羅', kana: 'ナカゴウラ', expected: 'nakagora' },
  { name: '上強羅', kana: 'カミゴウラ', expected: 'kamigora' },
  { name: '峰', kana: 'ミネ', expected: 'mine' },
  { name: '芳賀台', kana: 'ハガダイ', expected: 'hagadai' },
  { name: '富士山', kana: 'フジサン', expected: 'fujisan' },
  { name: '新相ノ木', kana: 'シンアイノキ', expected: 'shinainoki' },
  { name: '新黒部', kana: 'シンクロベ', expected: 'shinkurobe' },
  { name: '栄町', kana: 'サカエマチ', expected: 'sakaemachi' },
  { name: '中町（西町北）', kana: 'ナカマチ（ニシチョウキタ）', expected: 'nakamachinishichokita' },
  { name: '陽羽里', kana: 'ヒバリ', expected: 'hibari' },
  { name: 'まつもと町屋', kana: 'マツモトマチヤ', expected: 'matsumotomachiya' },
  { name: '西長田ゆりの里', kana: 'ニシナガタユリノサト', expected: 'nishinagatayurinosato' },
  { name: '下兵庫こうふく', kana: 'シモヒョウゴコウフク', expected: 'shimohyogokofuku' },
  { name: 'たけふ新', kana: 'タケフシン', expected: 'takefushin' },
  { name: '泰澄の里', kana: 'タイチョウノサト', expected: 'taichonosato' },
  { name: 'ハーモニーホール', kana: 'ハーモニーホール', expected: 'hamonihoru' },
  { name: '商工会議所前', kana: 'ショウコウカイギショマエ', expected: 'shokokaigishomae' },
  { name: '足羽山公園口', kana: 'アスワヤマコウエングチ', expected: 'asuwayamakoenguchi' },
  { name: '高岡やぶなみ', kana: 'タカオカヤブナミ', expected: 'takaokayabunami' },
  { name: '新富山口', kana: 'シントヤマグチ', expected: 'shintoyamaguchi' },
  { name: '西松任', kana: 'ニシマットウ', expected: 'nishimatto' },
  { name: '城ヶ崎海岸', kana: 'ジョウガサキカイガン', expected: 'jogasakikaigan' },
  { name: '森町病院前', kana: 'モリマチビョウインマエ', expected: 'morimachibyoinmae' },
  { name: 'フルーツパーク', kana: 'フルーツパーク', expected: 'furutsupaku' },
  { name: '常葉大学前', kana: 'トコハダイガクマエ', expected: 'tokohadaigakumae' },
  { name: '岡地', kana: 'オカチ', expected: 'okachi' },
  { name: 'ナゴヤドーム前矢田', kana: 'ナゴヤドームマエヤダ', expected: 'nagoyadomumaeyada' },
  { name: '名古屋城', kana: 'ナゴヤジョウ', expected: 'nagoyajo' },
  { name: '太閤通', kana: 'タイコウドオリ', expected: 'taikodori' },
  { name: '鳴子北', kana: 'ナルコキタ', expected: 'narukokita' },
  { name: '金屋', kana: 'カナヤ', expected: 'kanaya' },
  { name: 'せきてらす前', kana: 'セキテラスマエ', expected: 'sekiterasumae' },
  { name: '四十九', kana: 'シジュク', expected: 'shijuku' },
  { name: 'ひこね芹川', kana: 'ヒコネセリカワ', expected: 'hikoneserikawa' },
  { name: '夢洲', kana: 'ユメシマ', expected: 'yumeshima' },
  { name: 'ドーム前千代崎', kana: 'ドームマエチヨザキ', expected: 'domumaechiyozaki' },
  { name: 'フェリーターミナル', kana: 'フェリーターミナル', expected: 'feritaminaru' },
  { name: '柴原阪大前', kana: 'シバハラハンダイマエ', expected: 'shibaharahandaimae' },
  { name: '新今宮駅前', kana: 'シンイマミヤエキマエ', expected: 'shinimamiyaekimae' },
  { name: '石津北', kana: 'イシヅキタ', expected: 'ishizukita' },
  { name: '西江井ヶ島', kana: 'ニシエイガシマ', expected: 'nishieigashima' },
  { name: 'ポートターミナル', kana: 'ポートターミナル', expected: 'pototaminaru' },
  { name: '松江フォーゲルパーク', kana: 'マツエフォーゲルパーク', expected: 'matsuefogerupaku' },
  { name: '広電西広島（己斐）', kana: 'ヒロデンニシヒロシマ（コイ）', expected: 'hirodennishihiroshimakoi' },
  { name: '伏石', kana: 'フセイシ', expected: 'fuseishi' },
  { name: '昭和町通', kana: 'ショウワマチドオリ', expected: 'showamachidori' },
  { name: '観光通', kana: 'カンコウドオリ', expected: 'kankodori' },
  { name: '熊本高専前', kana: 'クマモトコウセンマエ', expected: 'kumamotokosenmae' },
  { name: '南阿蘇白川水源', kana: 'ミナミアソシラカワスイゲン', expected: 'minamiasoshirakawasuigen' },
  { name: '新水前寺駅前', kana: 'シンスイゼンジエキマエ', expected: 'shinsuizenjiekimae' },
  { name: '郡元南', kana: 'コオリモトミナミ', expected: 'korimotominami' },
  { name: '石嶺', kana: 'イシミネ', expected: 'ishimine' },
  { name: '経塚', kana: 'キョウヅカ', expected: 'kyozuka' },
  { name: '浦添前田', kana: 'ウラソエマエダ', expected: 'urasoemaeda' },
  { name: '出光美術館', kana: 'イデミツビジュツカン', expected: 'idemitsubijutsukan' },
  { name: '関門海峡めかり', kana: 'カンモンカイキョウメカリ', expected: 'kanmonkaikyomekari' },
];

describe('hepburn: 回帰（実CSV155駅）', () => {
  it.each(FIXTURE)('$name（$kana）→ $expected', ({ kana, expected }) => {
    expect(hepburn(kana)).toBe(expected);
  });
});
