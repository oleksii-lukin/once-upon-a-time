#!/usr/bin/env python3
"""
Generate seed.sql file with i18n support for all cards.
This script creates the complete seed file with translations in EN, RU, and UA.
"""

import json

def escape_sql(text):
    """Escape single quotes for SQL"""
    return text.replace("'", "''")

def create_translation_json(name, description, usage_examples, ru_name=None, ru_desc=None, ru_usage=None, ua_name=None, ua_desc=None, ua_usage=None, image_urls=None):
    """Create the translations JSONB structure with locale-specific image support"""
    translations = {
        "en": {
            "name": name,
            "description": description,
            "usage_examples": usage_examples
        },
        "ru": {
            "name": ru_name if ru_name else f"[RU] {name}",
            "description": ru_desc if ru_desc else f"[RU] {description}",
            "usage_examples": ru_usage if ru_usage else f"[RU] {usage_examples}"
        },
        "ua": {
            "name": ua_name if ua_name else f"[UA] {name}",
            "description": ua_desc if ua_desc else f"[UA] {description}",
            "usage_examples": ua_usage if ua_usage else f"[UA] {usage_examples}"
        }
    }
    
    # Add locale-specific image URLs if provided
    if image_urls:
        # image_urls structure: {'locale_images': {'en': 'url1', 'ru': 'url2'}, 'generic_image': 'url3'}
        locale_images = image_urls.get('locale_images', {})
        generic_image = image_urls.get('generic_image')
        
        # Add image URLs to each locale, with fallback logic
        for locale in ['en', 'ru', 'ua']:
            if locale in locale_images:
                # Use locale-specific image
                translations[locale]['image_url'] = locale_images[locale]
            elif generic_image:
                # Fall back to generic image
                translations[locale]['image_url'] = generic_image
            # If no image available, don't add image_url field
    
    # Return as compact JSON string, escaping single quotes
    return escape_sql(json.dumps(translations, ensure_ascii=False, separators=(',', ':')))

# Card data structure: (name, description, usage_examples, type, category)
protagonists = [
    ("The Reluctant Hero", "A character who is called to adventure but initially resists their destiny, only to rise when needed most.", "Use when introducing a main character who doubts themselves or when showing character growth.",
     "Неохотный герой", "Персонаж, призванный к приключениям, но поначалу сопротивляющийся своей судьбе, чтобы восстать, когда это нужнее всего.", "Используйте, когда представляете главного героя, который сомневается в себе, или когда показываете рост персонажа.",
     "Герой мимоволі", "Персонаж, покликаний до пригод, але спочатку опирається своїй долі, щоб повстати, коли це найбільше потрібно.", "Використовуйте, коли представляєте головного героя, який сумнівається в собі, або коли показуєте ріст персонажа."),
    ("The Chosen One", "A person marked by prophecy or fate to accomplish a great deed, bearing the weight of destiny.", "Play when revealing a character's special purpose or when prophecy becomes relevant.",
     "Избранный", "Человек, отмеченный пророчеством или судьбой для совершения великого дела, несущий бремя судьбы.", "Играйте, когда раскрываете особое предназначение персонажа или когда пророчество становится актуальным.",
     "Обраний", "Людина, позначена пророцтвом або долею для здійснення великого вчинку, що несе тягар долі.", "Грайте, коли розкриваєте особливе призначення персонажа або коли пророцтво стає актуальним."),
    ("The Orphaned Child", "A young soul without family, seeking belonging and purpose in a harsh world.", "Introduce to create sympathy or when exploring themes of family and identity.",
     "Сирота", "Юная душа без семьи, ищущая принадлежности и цели в суровом мире.", "Вводите, чтобы вызвать сочувствие или при исследовании тем семьи и идентичности.",
     "Сирота", "Юна душа без сім'ї, що шукає приналежності та мети в суворому світі.", "Вводьте, щоб викликати співчуття або при дослідженні тем сім'ї та ідентичності."),
    ("The Exiled Prince", "Royalty cast out from their kingdom, seeking redemption or revenge.", "Use when introducing political intrigue or a character with a claim to power.",
     "Изгнанный принц", "Член королевской семьи, изгнанный из своего королевства, ищущий искупления или мести.", "Используйте при введении политических интриг или персонажа с претензией на власть.",
     "Вигнаний принц", "Член королівської сім'ї, вигнаний зі свого королівства, що шукає спокути або помсти.", "Використовуйте при введенні політичних інтриг або персонажа з претензією на владу."),
    ("The Brave Farmhand", "A simple worker with extraordinary courage hidden beneath an ordinary exterior.", "Play to show that heroism can come from anywhere, not just nobility.",
     "Храбрый батрак", "Простой работник с необычайной храбростью, скрытой под обычной внешностью.", "Играйте, чтобы показать, что героизм может прийти откуда угодно, не только от знати.",
     "Хоробрий наймит", "Простий працівник з надзвичайною хоробрістю, прихованою під звичайною зовнішністю.", "Грайте, щоб показати, що героїзм може прийти звідки завгодно, не тільки від знаті."),
    ("The Cursed Wanderer", "A traveler bearing a terrible curse, seeking either a cure or acceptance.", "Introduce when adding mystery or when a character needs a dark secret.",
     "Проклятый странник", "Путешественник, несущий ужасное проклятие, ищущий либо исцеления, либо принятия.", "Вводите, когда добавляете тайну или когда персонажу нужен темный секрет.",
     "Проклятий мандрівник", "Мандрівник, що несе жахливе прокляття, шукає або зцілення, або прийняття.", "Вводьте, коли додаєте таємницю або коли персонажу потрібен темний секрет."),
    ("The Silent Guardian", "A protector who watches from the shadows, speaking rarely but acting decisively.", "Use for mysterious protector figures or when actions speak louder than words.",
     "Безмолвный страж", "Защитник, наблюдающий из теней, редко говорящий, но действующий решительно.", "Используйте для таинственных фигур защитников или когда действия говорят громче слов.",
     "Мовчазний вартий", "Захисник, що спостерігає з тіней, рідко говорить, але діє рішуче.", "Використовуйте для таємничих фігур захисників або коли дії говорять голосніше слів."),
    ("The Clever Thief", "A cunning rogue who steals not just treasures, but also hearts and secrets.", "Play when wit and stealth are needed, or to add moral complexity.",
     "Хитрый вор", "Ловкий плут, крадущий не только сокровища, но и сердца и секреты.", "Играйте, когда нужны остроумие и скрытность, или чтобы добавить моральной сложности.",
     "Хитрий злодій", "Спритний шахрай, що краде не тільки скарби, а й серця і секрети.", "Грайте, коли потрібні дотепність і скритність, або щоб додати моральної складності."),
    ("The Loyal Companion", "A steadfast friend who will never abandon their allies, no matter the cost.", "Introduce to strengthen bonds between characters or show unwavering friendship.",
     "Верный спутник", "Непоколебимый друг, который никогда не бросит своих союзников, чего бы это ни стоило.", "Вводите, чтобы укрепить связи между персонажами или показать непоколебимую дружбу.",
     "Вірний супутник", "Непохитний друг, який ніколи не кине своїх союзників, чого б це не коштувало.", "Вводьте, щоб зміцнити зв'язки між персонажами або показати непохитну дружбу."),
    ("The Talking Animal", "A beast with the gift of speech, offering wisdom, humor, or unexpected insight.", "Use to add whimsy or when nature itself needs a voice.",
     "Говорящее животное", "Зверь с даром речи, предлагающий мудрость, юмор или неожиданное прозрение.", "Используйте, чтобы добавить причудливости или когда самой природе нужен голос.",
     "Тварина, що говорить", "Звір з даром мови, що пропонує мудрість, гумор або несподіване прозріння.", "Використовуйте, щоб додати химерності або коли самій природі потрібен голос."),
    ("The Wise Mentor", "An experienced guide who teaches and prepares the hero for their journey.", "Play when the hero needs guidance or when wisdom must be passed down.",
     "Мудрый наставник", "Опытный проводник, который учит и готовит героя к его путешествию.", "Играйте, когда герою нужно руководство или когда мудрость должна быть передана.",
     "Мудрий наставник", "Досвідчений провідник, який вчить і готує героя до його подорожі.", "Грайте, коли герою потрібне керівництво або коли мудрість повинна бути передана."),
    ("The Retired Knight", "A warrior who hung up their sword, but may be called to fight once more.", "Introduce when experience is needed or to explore themes of aging and purpose.",
     "Отставной рыцарь", "Воин, повесивший свой меч, но который может быть призван сражаться снова.", "Вводите, когда нужен опыт или для исследования тем старения и предназначения.",
     "Лицар у відставці", "Воїн, що повісив свій меч, але який може бути покликаний битися знову.", "Вводьте, коли потрібен досвід або для дослідження тем старіння і призначення."),
    ("The Rebellious Heir", "A successor who rejects tradition and forges their own path.", "Use when challenging authority or exploring generational conflict.",
     "Мятежный наследник", "Преемник, отвергающий традиции и прокладывающий свой собственный путь.", "Используйте, когда бросаете вызов власти или исследуете конфликт поколений.",
     "Бунтівний спадкоємець", "Наступник, що відкидає традиції і прокладає свій власний шлях.", "Використовуйте, коли кидаєте виклик владі або досліджуєте конфлікт поколінь."),
    ("The Seer with No Eyes", "A blind prophet who sees truths others cannot perceive.", "Play when prophecy or hidden knowledge becomes important.",
     "Слепой провидец", "Слепой пророк, видящий истины, которые другие не могут воспринять.", "Играйте, когда пророчество или скрытое знание становятся важными.",
     "Сліпий провидець", "Сліпий пророк, що бачить істини, які інші не можуть сприйняти.", "Грайте, коли пророцтво або приховане знання стають важливими."),
    ("The Apprentice Mage", "A young magic user still learning to control their growing powers.", "Introduce when magic goes awry or when potential must be nurtured.",
     "Ученик мага", "Юный маг, все еще учащийся контролировать свои растущие силы.", "Вводите, когда магия идет наперекосяк или когда потенциал нужно взращивать.",
     "Учень мага", "Юний маг, що все ще вчиться контролювати свої зростаючі сили.", "Вводьте, коли магія йде шкереберть або коли потенціал потрібно плекати."),
    ("The Grizzled Mercenary", "A battle-hardened soldier who fights for coin, but may find a cause worth dying for.", "Use to add cynicism that can transform into idealism.",
     "Седой наемник", "Закаленный в боях солдат, сражающийся за монету, но который может найти дело, за которое стоит умереть.", "Используйте, чтобы добавить цинизма, который может превратиться в идеализм.",
     "Сивий найманець", "Загартований у боях солдат, що б'ється за монету, але який може знайти справу, за яку варто померти.", "Використовуйте, щоб додати цинізму, який може перетворитися на ідеалізм."),
    ("The Fool Who Knows Too Much", "A jester or simpleton who speaks uncomfortable truths disguised as jokes.", "Play when truth needs to be spoken or when wisdom comes from unexpected sources.",
     "Шут, знающий слишком много", "Шут или простак, говорящий неудобные истины, замаскированные под шутки.", "Играйте, когда правда должна быть сказана или когда мудрость исходит из неожиданных источников.",
     "Блазень, що знає забагато", "Блазень або простак, що говорить незручні істини, замасковані під жарти.", "Грайте, коли правда повинна бути сказана або коли мудрість виходить з несподіваних джерел."),
    ("The Shape-shifting Ally", "A friend who can change their form, hiding their true nature.", "Introduce to add mystery or when identity becomes fluid.",
     "Оборотень-союзник", "Друг, способный менять свою форму, скрывая свою истинную природу.", "Вводите, чтобы добавить тайну или когда идентичность становится изменчивой.",
     "Перевертень-союзник", "Друг, здатний змінювати свою форму, приховуючи свою справжню природу.", "Вводьте, щоб додати таємницю або коли ідентичність стає мінливою."),
    ("The Ghost of a Friend", "A departed companion who returns to offer aid from beyond death.", "Use when the past haunts the present or when closure is needed.",
     "Призрак друга", "Ушедший спутник, возвращающийся, чтобы предложить помощь из-за черты смерти.", "Используйте, когда прошлое преследует настоящее или когда нужно закрыть гештальт.",
     "Привид друга", "Померлий супутник, що повертається, щоб запропонувати допомогу з-за межі смерті.", "Використовуйте, коли минуле переслідує сьогодення або коли потрібно закрити гештальт."),
    ("The Forgotten Twin", "A sibling lost or hidden, whose return changes everything.", "Play to introduce shocking revelations or family drama.",
     "Забытый близнец", "Потерянный или спрятанный брат/сестра, чье возвращение меняет все.", "Играйте, чтобы ввести шокирующие откровения или семейную драму.",
     "Забутий близнюк", "Втрачений або захований брат/сестра, чиє повернення змінює все.", "Грайте, щоб ввести шокуючі одкровення або сімейну драму."),
    ("The Healer with a Secret", "One who mends wounds but carries a hidden burden or dark knowledge.", "Introduce when healing is needed or when secrets must be revealed.",
     "Целитель с тайной", "Тот, кто лечит раны, но несет скрытое бремя или темное знание.", "Вводите, когда нужно исцеление или когда секреты должны быть раскрыты.",
     "Цілитель з таємницею", "Той, хто лікує рани, але несе прихований тягар або темне знання.", "Вводьте, коли потрібне зцілення або коли секрети повинні бути розкриті."),
    ("The Bard Who Can't Lie", "A storyteller cursed or blessed to speak only truth through song.", "Use when truth must be revealed or when music drives the narrative.",
     "Бард, не умеющий лгать", "Рассказчик, проклятый или благословленный говорить только правду через песню.", "Используйте, когда правда должна быть раскрыта или когда музыка движет повествование.",
     "Бард, що не вміє брехати", "Оповідач, проклятий або благословенний говорити тільки правду через пісню.", "Використовуйте, коли правда повинна бути розкрита або коли музика рухає розповідь."),
    ("The Last of Their Kind", "The final survivor of a lost people, carrying their legacy alone.", "Play to explore themes of extinction, preservation, and loneliness.",
     "Последний из своего рода", "Последний выживший из исчезнувшего народа, несущий их наследие в одиночку.", "Играйте для исследования тем вымирания, сохранения и одиночества.",
     "Останній зі свого роду", "Останній, хто вижив зі зниклого народу, що несе їх спадщину наодинці.", "Грайте для дослідження тем вимирання, збереження та самотності."),
    ("The Child of Prophecy", "A young one foretold to bring great change, for good or ill.", "Introduce when destiny and innocence collide.",
     "Дитя пророчества", "Юное создание, которому предсказано принести великие перемены, к добру или к худу.", "Вводите, когда судьба и невинность сталкиваются.",
     "Дитя пророцтва", "Юне створіння, якому передбачено принести великі зміни, до добра чи до лиха.", "Вводьте, коли доля і невинність стикаються."),
    ("The Time-Lost Stranger", "Someone displaced from their era, struggling to understand a changed world.", "Use when exploring themes of change, nostalgia, or fish-out-of-water scenarios.",
     "Странник, потерянный во времени", "Кто-то, перемещенный из своей эпохи, пытающийся понять изменившийся мир.", "Используйте при исследовании тем перемен, ностальгии или сценариев «не в своей тарелке».",
     "Мандрівник, загублений у часі", "Хтось, переміщений зі своєї епохи, що намагається зрозуміти світ, який змінився.", "Використовуйте при дослідженні тем змін, ностальгії або сценаріїв «не в своїй тарілці»."),
    ("The Inventor of Impossible Things", "A creator who defies the laws of nature with their ingenious devices.", "Play when innovation is needed or when science meets magic.",
     "Изобретатель невозможного", "Творец, бросающий вызов законам природы своими гениальными устройствами.", "Играйте, когда нужны инновации или когда наука встречается с магией.",
     "Винахідник неможливого", "Творець, що кидає виклик законам природи своїми геніальними пристроями.", "Грайте, коли потрібні інновації або коли наука зустрічається з магією."),
    ("The One Who Remembers", "A keeper of memories in a world that has forgotten its past.", "Introduce when history is important or when the past must be reclaimed.",
     "Тот, кто помнит", "Хранитель воспоминаний в мире, который забыл свое прошлое.", "Вводите, когда история важна или когда прошлое должно быть возвращено.",
     "Той, хто пам'ятає", "Зберігач спогадів у світі, який забув своє минуле.", "Вводьте, коли історія важлива або коли минуле повинно бути повернуто."),
    ("The Peacemaker", "One who seeks harmony and understanding between warring factions.", "Use when conflict needs resolution or when diplomacy is the answer.",
     "Миротворец", "Тот, кто ищет гармонии и понимания между враждующими фракциями.", "Используйте, когда конфликт требует разрешения или когда дипломатия — это ответ.",
     "Миротворець", "Той, хто шукає гармонії та розуміння між ворогуючими фракціями.", "Використовуйте, коли конфлікт вимагає вирішення або коли дипломатія — це відповідь."),
    ("The Reluctant Leader", "Someone thrust into command who doubts their ability to lead.", "Play when leadership is needed but confidence is lacking.",
     "Неохотный лидер", "Кто-то, вынужденный командовать, кто сомневается в своей способности вести за собой.", "Играйте, когда нужно лидерство, но не хватает уверенности.",
     "Неохочий лідер", "Хтось, змушений командувати, хто сумнівається у своїй здатності вести за собою.", "Грайте, коли потрібне лідерство, але не вистачає впевненості."),
    ("The Dreamer Who Dared", "A visionary who pursues impossible dreams against all odds.", "Introduce when hope and ambition drive the story forward.",
     "Мечтатель, который осмелился", "Визионер, преследующий невозможные мечты вопреки всему.", "Вводите, когда надежда и амбиции двигают историю вперед.",
     "Мрійник, що наважився", "Візіонер, що переслідує неможливі мрії всупереч усьому.", "Вводьте, коли надія і амбіції рухають історію вперед."),
]

antagonists = [
    ("The Shadow King", "A dark ruler who commands from the shadows, spreading fear and corruption.", "Use as a primary villain or when introducing political darkness.",
     "Король Теней", "Темный правитель, командующий из теней, распространяющий страх и коррупцию.", "Используйте как главного злодея или при введении политической тьмы.",
     "Король Тіней", "Темний правитель, що командує з тіней, поширюючи страх і корупцію.", "Використовуйте як головного лиходія або при введенні політичної темряви."),
    ("The Betrayer Within", "A trusted ally who reveals their true treacherous nature at a critical moment.", "Play when trust is broken or when revealing a shocking betrayal.",
     "Предатель внутри", "Доверенный союзник, раскрывающий свою истинную предательскую натуру в критический момент.", "Играйте, когда доверие нарушено или при раскрытии шокирующего предательства.",
     "Зрадник всередині", "Довірений союзник, що розкриває свою справжню зрадницьку натуру в критичний момент.", "Грайте, коли довіра порушена або при розкритті шокуючої зради."),
    ("The Cursed Beast", "A monster born from magic or tragedy, driven by instinct and suffering.", "Introduce when facing a tragic villain or a force of nature.",
     "Проклятый зверь", "Монстр, рожденный магией или трагедией, движимый инстинктом и страданием.", "Вводите, когда сталкиваетесь с трагическим злодеем или силой природы.",
     "Проклятий звір", "Монстр, народжений магією або трагедією, керований інстинктом і стражданням.", "Вводьте, коли стикаєтеся з трагічним лиходієм або силою природи."),
    ("The False Prophet", "A charismatic deceiver who leads followers astray with lies disguised as truth.", "Use when exploring themes of manipulation and false faith.",
     "Лжепророк", "Харизматичный обманщик, вводящий последователей в заблуждение ложью, замаскированной под правду.", "Используйте при исследовании тем манипуляции и ложной веры.",
     "Лжепророк", "Харизматичний ошуканець, що вводить послідовників в оману брехнею, замаскованою під правду.", "Використовуйте при дослідженні тем маніпуляції та фальшивої віри."),
    ("The Puppetmaster", "A manipulator who controls others from behind the scenes.", "Play when revealing hidden control or conspiracy.",
     "Кукловод", "Манипулятор, управляющий другими из-за кулис.", "Играйте, когда раскрываете скрытый контроль или заговор.",
     "Ляльковод", "Маніпулятор, що керує іншими з-за лаштунків.", "Грайте, коли розкриваєте прихований контроль або змову."),
    ("The Ancient Evil", "A primordial force of darkness that predates civilization itself.", "Introduce when facing ultimate evil or ancient threats.",
     "Древнее зло", "Изначальная сила тьмы, предшествующая самой цивилизации.", "Вводите, когда сталкиваетесь с абсолютным злом или древними угрозами.",
     "Стародавнє зло", "Первісна сила темряви, що передує самій цивілізації.", "Вводьте, коли стикаєтеся з абсолютним злом або стародавніми загрозами."),
    ("The Smiling Assassin", "A killer who wears a friendly face while plotting murder.", "Use when danger hides behind charm.",
     "Улыбающийся убийца", "Убийца, носящий дружелюбное лицо, замышляя убийство.", "Используйте, когда опасность скрывается за обаянием.",
     "Усміхнений вбивця", "Вбивця, що носить доброзичливе обличчя, задумуючи вбивство.", "Використовуйте, коли небезпека ховається за чарівністю."),
    ("The Tyrant Queen", "A ruthless monarch who rules through fear and absolute power.", "Play when introducing oppressive authority.",
     "Королева-тиран", "Безжалостный монарх, правящий через страх и абсолютную власть.", "Играйте, когда вводите деспотичную власть.",
     "Королева-тиран", "Безжалісний монарх, що править через страх і абсолютну владу.", "Грайте, коли вводите деспотичну владу."),
    ("The Whispering Mask", "A mysterious figure whose true face is never seen, speaking in riddles and lies.", "Introduce when mystery and deception are key.",
     "Шепчущая маска", "Таинственная фигура, чье истинное лицо никогда не видно, говорящая загадками и ложью.", "Вводите, когда тайна и обман являются ключевыми.",
     "Маска, що шепоче", "Таємнича фігура, чиє справжнє обличчя ніколи не видно, що говорить загадками і брехнею.", "Вводьте, коли таємниця і обман є ключовими."),
    ("The Mirror Doppelgänger", "An evil twin or duplicate that mimics and corrupts.", "Use when exploring identity or facing oneself.",
     "Зеркальный двойник", "Злой близнец или дубликат, который подражает и развращает.", "Используйте при исследовании идентичности или столкновении с самим собой.",
     "Дзеркальний двійник", "Злий близнюк або дублікат, який наслідує і розбещує.", "Використовуйте при дослідженні ідентичності або зіткненні з самим собою."),
    ("The Corrupted Mentor", "A once-wise teacher who has fallen to darkness and now corrupts others.", "Play when trust in authority is shattered.",
     "Развращенный наставник", "Некогда мудрый учитель, павший во тьму и теперь развращающий других.", "Играйте, когда вера в авторитеты разрушена.",
     "Розбещений наставник", "Колись мудрий вчитель, що впав у темряву і тепер розбещує інших.", "Грайте, коли віра в авторитети зруйнована."),
    ("The Unseen Watcher", "An entity that observes from the darkness, its motives unknown.", "Introduce when paranoia and surveillance are themes.",
     "Невидимый наблюдатель", "Сущность, наблюдающая из темноты, чьи мотивы неизвестны.", "Вводите, когда паранойя и наблюдение являются темами.",
     "Невидимий спостерігач", "Сутність, що спостерігає з темряви, чиї мотиви невідомі.", "Вводьте, коли параноя і спостереження є темами."),
    ("The Collector of Souls", "A being that harvests life essence or spirits for dark purposes.", "Use when death and the afterlife are at stake.",
     "Собиратель душ", "Существо, собирающее жизненную эссенцию или духов для темных целей.", "Используйте, когда смерть и загробная жизнь на кону.",
     "Збирач душ", "Істота, що збирає життєву есенцію або духів для темних цілей.", "Використовуйте, коли смерть і потойбічне життя на кону."),
    ("The Laughing Plague", "A disease or curse that spreads madness and hysteria.", "Play when facing an epidemic or loss of sanity.",
     "Смеющаяся чума", "Болезнь или проклятие, распространяющее безумие и истерию.", "Играйте, когда сталкиваетесь с эпидемией или потерей рассудка.",
     "Чума, що сміється", "Хвороба або прокляття, що поширює божевілля та істерію.", "Грайте, коли стикаєтеся з епідемією або втратою розуму."),
    ("The Eternal Duelist", "A warrior who challenges all to combat, never satisfied, never defeated.", "Introduce when honor and combat are central.",
     "Вечный дуэлянт", "Воин, бросающий вызов всем на бой, никогда не удовлетворенный, никогда не побежденный.", "Вводите, когда честь и бой являются центральными.",
     "Вічний дуелянт", "Воїн, що кидає виклик усім на бій, ніколи не задоволений, ніколи не переможений.", "Вводьте, коли честь і бій є центральними."),
    ("The Fallen Hero", "A once-great champion who has become what they once fought against.", "Use to explore tragedy and the corruption of ideals.",
     "Падший герой", "Некогда великий чемпион, ставший тем, против чего он когда-то сражался.", "Используйте для исследования трагедии и коррупции идеалов.",
     "Полеглий герой", "Колись великий чемпіон, що став тим, проти чого він колись бився.", "Використовуйте для дослідження трагедії та корупції ідеалів."),
    ("The Living Storm", "A sentient tempest that destroys without mercy or reason.", "Play when facing nature's wrath personified.",
     "Живая буря", "Разумная буря, уничтожающая без жалости и причины.", "Играйте, когда сталкиваетесь с олицетворенным гневом природы.",
     "Жива буря", "Розумна буря, що знищує без жалю і причини.", "Грайте, коли стикаєтеся з уособленим гнівом природи."),
    ("The Hunger That Walks", "An insatiable force that consumes everything in its path.", "Introduce when facing unstoppable consumption.",
     "Голод, что ходит", "Ненасытная сила, поглощающая все на своем пути.", "Вводите, когда сталкиваетесь с неостановимым потреблением.",
     "Голод, що ходить", "Ненаситна сила, що поглинає все на своєму шляху.", "Вводьте, коли стикаєтеся з невпинним споживанням."),
    ("The Forgotten God", "A deity abandoned by worshippers, now seeking revenge or recognition.", "Use when exploring themes of faith and abandonment.",
     "Забытый бог", "Божество, покинутое верующими, теперь ищущее мести или признания.", "Используйте при исследовании тем веры и покинутости.",
     "Забутий бог", "Божество, покинуте віруючими, що тепер шукає помсти або визнання.", "Використовуйте при дослідженні тем віри та покинутості."),
    ("The Bound Demon", "An evil entity trapped but seeking freedom to wreak havoc.", "Play when dealing with ancient prisons and forbidden power.",
     "Скованный демон", "Злая сущность, пойманная в ловушку, но ищущая свободы, чтобы сеять хаос.", "Играйте, когда имеете дело с древними тюрьмами и запретной силой.",
     "Скутий демон", "Зла сутність, спіймана в пастку, але шукає свободи, щоб сіяти хаос.", "Грайте, коли маєте справу зі стародавніми в'язницями та забороненою силою."),
    ("The Voice in the Flames", "A presence that speaks through fire, offering power at a terrible price.", "Introduce when temptation and deals with evil are themes.",
     "Голос в огне", "Присутствие, говорящее через огонь, предлагающее силу за ужасную цену.", "Вводите, когда искушение и сделки со злом являются темами.",
     "Голос у вогні", "Присутність, що говорить через вогонь, пропонуючи силу за жахливу ціну.", "Вводьте, коли спокуса та угоди зі злом є темами."),
    ("The One Who Knows Your Name", "An entity with power over those whose true names it learns.", "Use when names and identity hold magical significance.",
     "Тот, кто знает твое имя", "Сущность, имеющая власть над теми, чьи истинные имена она узнает.", "Используйте, когда имена и идентичность имеют магическое значение.",
     "Той, хто знає твоє ім'я", "Сутність, що має владу над тими, чиї справжні імена вона дізнається.", "Використовуйте, коли імена та ідентичність мають магічне значення."),
    ("The Clockwork Warden", "A mechanical enforcer that follows its programming without mercy.", "Play when facing cold, logical opposition.",
     "Заводной страж", "Механический страж, следующий своей программе без жалости.", "Играйте, когда сталкиваетесь с холодным, логичным сопротивлением.",
     "Механічний вартий", "Механічний вартий, що слідує своїй програмі без жалю.", "Грайте, коли стикаєтеся з холодним, логічним опором."),
    ("The Beast Beneath the City", "A monster lurking in the depths below civilization.", "Introduce when urban legends become real.",
     "Зверь под городом", "Монстр, скрывающийся в глубинах под цивилизацией.", "Вводите, когда городские легенды становятся реальностью.",
     "Звір під містом", "Монстр, що ховається в глибинах під цивілізацією.", "Вводьте, коли міські легенди стають реальністю."),
    ("The Curse of the Blood Moon", "A recurring supernatural event that brings transformation and terror.", "Use when cycles and lunar magic are important.",
     "Проклятие Кровавой Луны", "Повторяющееся сверхъестественное событие, приносящее трансформацию и ужас.", "Используйте, когда циклы и лунная магия важны.",
     "Прокляття Кривавого Місяця", "Надприродна подія, що повторюється, приносячи трансформацію та жах.", "Використовуйте, коли цикли та місячна магія важливі."),
    ("The Silent Inquisition", "A secretive organization that hunts and judges in silence.", "Play when introducing persecution and witch hunts.",
     "Безмолвная инквизиция", "Тайная организация, которая охотится и судит в тишине.", "Играйте, когда вводите преследование и охоту на ведьм.",
     "Мовчазна інквізиція", "Таємна організація, яка полює і судить в тиші.", "Грайте, коли вводите переслідування та полювання на відьом."),
    ("The Eyes in the Dark", "Watchers from the shadows whose gaze brings madness.", "Introduce when paranoia and unseen threats loom.",
     "Глаза во тьме", "Наблюдатели из теней, чей взгляд приносит безумие.", "Вводите, когда нависают паранойя и невидимые угрозы.",
     "Очі в темряві", "Спостерігачі з тіней, чий погляд приносить божевілля.", "Вводьте, коли нависають параноя та невидимі загрози."),
    ("The Broken Oath", "The consequence of a promise shattered, manifesting as a curse or entity.", "Use when vows and their breaking have power.",
     "Нарушенная клятва", "Последствие нарушенного обещания, проявляющееся как проклятие или сущность.", "Используйте, когда клятвы и их нарушение имеют силу.",
     "Порушена клятва", "Наслідок порушеної обіцянки, що проявляється як прокляття або сутність.", "Використовуйте, коли клятви та їх порушення мають силу."),
    ("The Price of Power", "The inevitable cost that comes due when forbidden strength is claimed.", "Play when exploring consequences of ambition.",
     "Цена власти", "Неизбежная цена, которая наступает, когда востребована запретная сила.", "Играйте при исследовании последствий амбиций.",
     "Ціна влади", "Неминуча ціна, яка настає, коли затребувана заборонена сила.", "Грайте при дослідженні наслідків амбіцій."),
    ("The Thing That Should Not Be", "An abomination that defies natural law and sanity itself.", "Introduce when facing cosmic horror or the unnatural.",
     "То, чего не должно быть", "Мерзость, бросающая вызов законам природы и самому рассудку.", "Вводите, когда сталкиваетесь с космическим ужасом или неестественным.",
     "Те, чого не повинно бути", "Мерзота, що кидає виклик законам природи і самому розуму.", "Вводьте, коли стикаєтеся з космічним жахом або неприродним."),
]

settings = [
    ("The Haunted Forest", "Ancient woods where spirits dwell and paths shift beneath unwary feet.", "Use when characters need to journey through dangerous wilderness.",
     "Проклятый лес", "Древние леса, где обитают духи, а тропы меняются под ногами неосторожных.", "Используйте, когда персонажам нужно путешествовать через опасную дикую местность.",
     "Проклятий ліс", "Стародавні ліси, де мешкають духи, а стежки змінюються під ногами необережних.", "Використовуйте, коли персонажам потрібно подорожувати через небезпечну дику місцевість."),
    ("The Crumbling Castle", "A once-grand fortress now falling to ruin, holding secrets in its decay.", "Play when exploring abandoned places or fallen kingdoms.",
     "Разрушающийся замок", "Некогда величественная крепость, ныне приходящая в упадок, хранящая секреты в своем разрушении.", "Играйте при исследовании заброшенных мест или павших королевств.",
     "Замок, що руйнується", "Колись велична фортеця, що нині занепадає, зберігаючи секрети у своєму руйнуванні.", "Грайте при дослідженні покинутих місць або полеглих королівств."),
    ("The Hidden Village", "A settlement concealed from the outside world, preserving old ways.", "Introduce when finding refuge or discovering lost communities.",
     "Скрытая деревня", "Поселение, скрытое от внешнего мира, сохраняющее старые обычаи.", "Вводите, когда находите убежище или открываете потерянные сообщества.",
     "Приховане село", "Поселення, приховане від зовнішнього світу, що зберігає старі звичаї.", "Вводьте, коли знаходите притулок або відкриваєте втрачені спільноти."),
    ("The Tower with No Doors", "A mysterious spire with no visible entrance, defying those who seek entry.", "Use when facing impossible architecture or magical barriers.",
     "Башня без дверей", "Таинственный шпиль без видимого входа, бросающий вызов тем, кто ищет входа.", "Используйте, когда сталкиваетесь с невозможной архитектурой или магическими барьерами.",
     "Вежа без дверей", "Таємничий шпиль без видимого входу, що кидає виклик тим, хто шукає входу.", "Використовуйте, коли стикаєтеся з неможливою архітектурою або магічними бар'єрами."),
    ("The City of Masks", "An urban center where everyone hides their true face behind elaborate disguises.", "Play when exploring themes of identity and deception.",
     "Город масок", "Городской центр, где каждый скрывает свое истинное лицо за сложными масками.", "Играйте при исследовании тем идентичности и обмана.",
     "Місто масок", "Міський центр, де кожен приховує своє справжнє обличчя за складними масками.", "Грайте при дослідженні тем ідентичності та обману."),
    ("The Frozen Wastes", "Endless ice and snow where survival itself is a daily battle.", "Introduce when facing harsh environments and isolation.",
     "Ледяные пустоши", "Бесконечный лед и снег, где само выживание — это ежедневная битва.", "Вводите, когда сталкиваетесь с суровыми условиями и изоляцией.",
     "Крижані пустки", "Нескінченний лід і сніг, де саме виживання — це щоденна битва.", "Вводьте, коли стикаєтеся з суворими умовами та ізоляцією."),
    ("The Desert of Whispers", "Arid lands where the wind carries voices of the lost and forgotten.", "Use when desolation and mystery combine.",
     "Пустыня шепотов", "Засушливые земли, где ветер несет голоса потерянных и забытых.", "Используйте, когда запустение и тайна сочетаются.",
     "Пустеля шепотів", "Посушливі землі, де вітер несе голоси втрачених і забутих.", "Використовуйте, коли запустіння і таємниця поєднуються."),
    ("The Library of Forgotten Names", "A vast repository of knowledge where even memories are catalogued and stored.", "Play when seeking knowledge or exploring the power of memory.",
     "Библиотека забытых имен", "Огромное хранилище знаний, где даже воспоминания каталогизируются и хранятся.", "Играйте при поиске знаний или исследовании силы памяти.",
     "Бібліотека забутих імен", "Величезне сховище знань, де навіть спогади каталогізуються і зберігаються.", "Грайте при пошуку знань або дослідженні сили пам'яті."),
    ("The Bridge Between Worlds", "A crossing point that connects different realms or realities.", "Introduce when traveling between planes or dimensions.",
     "Мост между мирами", "Точка пересечения, соединяющая разные царства или реальности.", "Вводите при путешествии между планами или измерениями.",
     "Міст між світами", "Точка перетину, що з'єднує різні царства або реальності.", "Вводьте при подорожі між планами або вимірами."),
    ("The Island That Moves", "A landmass that drifts across the sea, never found in the same place twice.", "Use when seeking the unfindable or dealing with shifting geography.",
     "Остров, который движется", "Участок суши, дрейфующий по морю, никогда не находящийся в одном и том же месте дважды.", "Используйте при поиске неуловимого или столкновении с меняющейся географией.",
     "Острів, що рухається", "Ділянка суші, що дрейфує по морю, ніколи не знаходиться в одному і тому ж місці двічі.", "Використовуйте при пошуку невловимого або зіткненні зі змінною географією."),
    ("The Market of Lost Things", "A bazaar where items thought gone forever can be found and purchased.", "Play when seeking specific objects or making deals.",
     "Рынок потерянных вещей", "Базар, где вещи, считавшиеся исчезнувшими навсегда, могут быть найдены и куплены.", "Играйте при поиске конкретных предметов или заключении сделок.",
     "Ринок загублених речей", "Базар, де речі, що вважалися зниклими назавжди, можуть бути знайдені і куплені.", "Грайте при пошуку конкретних предметів або укладанні угод."),
    ("The Sunken Temple", "A place of worship now beneath the waves, still holding ancient power.", "Introduce when exploring underwater or reclaiming the past.",
     "Затонувший храм", "Место поклонения, ныне находящееся под волнами, все еще хранящее древнюю силу.", "Вводите при исследовании подводного мира или возвращении прошлого.",
     "Затонулий храм", "Місце поклоніння, що нині знаходиться під хвилями, все ще зберігає стародавню силу.", "Вводьте при дослідженні підводного світу або поверненні минулого."),
    ("The Skyborne Citadel", "A fortress floating among the clouds, accessible only by flight or magic.", "Use when reaching for the heavens or facing aerial challenges.",
     "Небесная цитадель", "Крепость, парящая среди облаков, доступная только полетом или магией.", "Используйте, когда тянетесь к небесам или сталкиваетесь с воздушными испытаниями.",
     "Небесна цитадель", "Фортеця, що ширяє серед хмар, доступна тільки польотом або магією.", "Використовуйте, коли тягнетеся до небес або стикаєтеся з повітряними випробуваннями."),
    ("The Endless Staircase", "Steps that climb forever upward or descend into infinite depths.", "Play when facing impossible journeys or testing endurance.",
     "Бесконечная лестница", "Ступени, ведущие вечно вверх или спускающиеся в бесконечные глубины.", "Играйте, когда сталкиваетесь с невозможными путешествиями или проверкой выносливости.",
     "Нескінченні сходи", "Сходи, що ведуть вічно вгору або спускаються в нескінченні глибини.", "Грайте, коли стикаєтеся з неможливими подорожами або перевіркою витривалості."),
    ("The Garden of Bones", "A grotesque paradise where death blooms into strange beauty.", "Introduce when exploring the boundary between life and death.",
     "Сад костей", "Гротескный рай, где смерть расцветает в странную красоту.", "Вводите при исследовании границы между жизнью и смертью.",
     "Сад кісток", "Гротескний рай, де смерть розквітає в дивну красу.", "Вводьте при дослідженні кордону між життям і смертю."),
    ("The Hollow Mountain", "A peak with vast caverns inside, home to ancient civilizations or creatures.", "Use when delving underground or discovering hidden worlds.",
     "Полая гора", "Пик с огромными пещерами внутри, дом для древних цивилизаций или существ.", "Используйте при погружении под землю или открытии скрытых миров.",
     "Порожня гора", "Пік з величезними печерами всередині, дім для стародавніх цивілізацій або істот.", "Використовуйте при зануренні під землю або відкритті прихованих світів."),
    ("The Mirror Lake", "Waters so still they reflect not just images but truths and futures.", "Play when seeking visions or confronting reflections.",
     "Зеркальное озеро", "Воды настолько спокойные, что отражают не только образы, но и истины и будущее.", "Играйте при поиске видений или столкновении с отражениями.",
     "Дзеркальне озеро", "Води настільки спокійні, що відображають не тільки образи, а й істини і майбутнє.", "Грайте при пошуку видінь або зіткненні з відображеннями."),
    ("The Labyrinth Below", "Twisting passages beneath the earth where getting lost is inevitable.", "Introduce when facing confusion and the need to find a path.",
     "Лабиринт внизу", "Извилистые проходы под землей, где заблудиться неизбежно.", "Вводите, когда сталкиваетесь с путаницей и необходимостью найти путь.",
     "Лабіринт внизу", "Звивисті проходи під землею, де заблукати неминуче.", "Вводьте, коли стикаєтеся з плутаниною і необхідністю знайти шлях."),
    ("The Clockwork City", "A metropolis of gears and steam where everything runs with mechanical precision.", "Use when exploring themes of order, industry, and automation.",
     "Заводной город", "Мегаполис шестеренок и пара, где все работает с механической точностью.", "Используйте при исследовании тем порядка, промышленности и автоматизации.",
     "Заводне місто", "Мегаполіс шестерень і пари, де все працює з механічною точністю.", "Використовуйте при дослідженні тем порядку, промисловості та автоматизації."),
    ("The Battlefield of Ghosts", "A site of ancient war where the dead still fight their eternal conflict.", "Play when the past refuses to stay buried.",
     "Поле битвы призраков", "Место древней войны, где мертвые все еще ведут свой вечный конфликт.", "Играйте, когда прошлое отказывается оставаться похороненным.",
     "Поле битви привидів", "Місце стародавньої війни, де мертві все ще ведуть свій вічний конфлікт.", "Грайте, коли минуле відмовляється залишатися похованим."),
    ("The River of Time", "A waterway that flows through different eras, allowing travel through history.", "Introduce when time travel or temporal themes are important.",
     "Река времени", "Водный путь, текущий через разные эпохи, позволяющий путешествовать сквозь историю.", "Вводите, когда путешествия во времени или временные темы важны.",
     "Річка часу", "Водний шлях, що тече через різні епохи, дозволяючи подорожувати крізь історію.", "Вводьте, коли подорожі в часі або часові теми важливі."),
    ("The Forbidden Archives", "A collection of knowledge deemed too dangerous for common access.", "Use when seeking forbidden lore or facing censorship.",
     "Запретные архивы", "Коллекция знаний, считающихся слишком опасными для общего доступа.", "Используйте при поиске запретных знаний или столкновении с цензурой.",
     "Заборонені архіви", "Колекція знань, що вважаються занадто небезпечними для загального доступу.", "Використовуйте при пошуку заборонених знань або зіткненні з цензурою."),
    ("The Ship of the Dead", "A vessel crewed by spirits, sailing between the living world and the afterlife.", "Play when dealing with death, passage, and the supernatural.",
     "Корабль мертвых", "Судно, укомплектованное духами, плавающее между миром живых и загробным миром.", "Играйте, когда имеете дело со смертью, переходом и сверхъестественным.",
     "Корабель мертвих", "Судно, укомплектоване духами, що плаває між світом живих і потойбічним світом.", "Грайте, коли маєте справу зі смертю, переходом і надприродним."),
    ("The Dreaming Spire", "A tower where reality and dreams merge, making the impossible possible.", "Introduce when dreams become real or reality becomes fluid.",
     "Шпиль сновидений", "Башня, где реальность и сны сливаются, делая невозможное возможным.", "Вводите, когда сны становятся реальными или реальность становится текучей.",
     "Шпиль сновидінь", "Вежа, де реальність і сни зливаються, роблячи неможливе можливим.", "Вводьте, коли сни стають реальними або реальність стає плинною."),
    ("The Crater of Stars", "A massive impact site where fragments of the heavens fell to earth.", "Use when dealing with cosmic events or celestial power.",
     "Кратер звезд", "Место массивного удара, где фрагменты небес упали на землю.", "Используйте, когда имеете дело с космическими событиями или небесной силой.",
     "Кратер зірок", "Місце масивного удару, де фрагменти небес впали на землю.", "Використовуйте, коли маєте справу з космічними подіями або небесною силою."),
    ("The Edge of the World", "The boundary where known lands end and the unknown begins.", "Play when exploring the limits of the world or venturing into the void.",
     "Край света", "Граница, где заканчиваются известные земли и начинается неизвестное.", "Играйте при исследовании пределов мира или путешествии в пустоту.",
     "Край світу", "Кордон, де закінчуються відомі землі і починається невідоме.", "Грайте при дослідженні меж світу або подорожі в порожнечу."),
    ("The Moonlit Carnival", "A traveling fair that appears only under the full moon, offering wonders and dangers.", "Introduce when magic and entertainment combine.",
     "Лунный карнавал", "Бродячая ярмарка, появляющаяся только при полной луне, предлагающая чудеса и опасности.", "Вводите, когда магия и развлечения сочетаются.",
     "Місячний карнавал", "Бродячий ярмарок, що з'являється тільки при повному місяці, пропонуючи чудеса і небезпеки.", "Вводьте, коли магія і розваги поєднуються."),
    ("The Buried Cathedral", "A holy place swallowed by earth or sand, still resonating with sacred power.", "Use when uncovering lost faith or exploring buried history.",
     "Погребенный собор", "Святое место, поглощенное землей или песком, все еще резонирующее священной силой.", "Используйте при открытии утраченной веры или исследовании погребенной истории.",
     "Похований собор", "Святе місце, поглинене землею або піском, все ще резонує священною силою.", "Використовуйте при відкритті втраченої віри або дослідженні похованої історії."),
    ("The Realm of Echoes", "A place where every sound, word, and action repeats endlessly.", "Play when dealing with consequences or the weight of the past.",
     "Царство эха", "Место, где каждый звук, слово и действие повторяются бесконечно.", "Играйте, когда имеете дело с последствиями или тяжестью прошлого.",
     "Царство відлуння", "Місце, де кожен звук, слово і дія повторюються нескінченно.", "Грайте, коли маєте справу з наслідками або вагою минулого."),
    ("The Last Safe Place", "A final refuge in a world falling to darkness or chaos.", "Introduce when hope is scarce and sanctuary is precious.",
     "Последнее безопасное место", "Последнее убежище в мире, погружающемся во тьму или хаос.", "Вводите, когда надежды мало, а убежище драгоценно.",
     "Останнє безпечне місце", "Останній притулок у світі, що занурюється в темряву або хаос.", "Вводьте, коли надії мало, а притулок дорогоцінний."),
]

objects = [
    ("The Sword of Truth", "A blade that cuts through lies and reveals what is hidden.", "Use when truth must be revealed or deception must be cut away.",
     "Меч Истины", "Клинок, рассекающий ложь и открывающий скрытое.", "Используйте, когда правда должна быть раскрыта или обман должен быть отсечен.",
     "Меч Істини", "Лезо, що розсікає брехню і розкриває приховане.", "Використовуйте, коли правда повинна бути розкрита або обман повинен бути відсічений."),
    ("The Crown of Lies", "A royal circlet that grants power through deception and illusion.", "Play when exploring corruption of power or the price of rule.",
     "Корона Лжи", "Королевский обруч, дарующий власть через обман и иллюзии.", "Играйте при исследовании коррупции власти или цены правления.",
     "Корона Брехні", "Королівський обруч, що дарує владу через обман та ілюзії.", "Грайте при дослідженні корупції влади або ціни правління."),
    ("The Map of Destiny", "A chart that shows not where you are, but where you are meant to be.", "Introduce when fate and free will collide.",
     "Карта Судьбы", "Карта, показывающая не где вы находитесь, а где вам суждено быть.", "Вводите, когда судьба и свобода воли сталкиваются.",
     "Карта Долі", "Карта, що показує не де ви знаходитесь, а де вам судилося бути.", "Вводьте, коли доля і свобода волі стикаються."),
    ("The Elixir of Memory", "A potion that can restore lost memories or erase unwanted ones.", "Use when the past must be remembered or forgotten.",
     "Эликсир Памяти", "Зелье, способное восстановить потерянные воспоминания или стереть нежелательные.", "Используйте, когда прошлое нужно вспомнить или забыть.",
     "Еліксир Пам'яті", "Зілля, здатне відновити втрачені спогади або стерти небажані.", "Використовуйте, коли минуле потрібно згадати або забути."),
    ("The Ring of Binding", "A band that creates unbreakable connections or imprisons the wearer.", "Play when bonds or imprisonment are themes.",
     "Кольцо Связывания", "Кольцо, создающее неразрывные связи или заточающее владельца.", "Играйте, когда узы или заточение являются темами.",
     "Перстень Зв'язування", "Перстень, що створює нерозривні зв'язки або ув'язнює власника. ", "Грайте, коли узи або ув'язнення є темами."),
    ("The Lantern of Lost Souls", "A light that guides the dead or reveals spirits to the living.", "Introduce when dealing with ghosts or the afterlife.",
     "Фонарь Потерянных Душ", "Свет, направляющий мертвых или открывающий духов живым.", "Вводите, когда имеете дело с призраками или загробной жизнью.",
     "Ліхтар Втрачених Душ", "Світло, що направляє мертвих або відкриває духів живим.", "Вводьте, коли маєте справу з привидами або потойбічним життям."),
    ("The Book That Writes Itself", "A tome that records events as they happen or predicts what will come.", "Use when prophecy or documentation is important.",
     "Книга, Которая Пишет Сама Себя", "Том, записывающий события по мере того, как они происходят, или предсказывающий грядущее.", "Используйте, когда пророчество или документация важны.",
     "Книга, Що Пише Сама Себе", "Том, що записує події в міру того, як вони відбуваються, або пророкує майбутнє.", "Використовуйте, коли пророцтво або документація важливі."),
    ("The Mirror of Regret", "A looking glass that shows not your reflection but your greatest mistakes.", "Play when confronting the past or seeking redemption.",
     "Зеркало Сожаления", "Зеркало, показывающее не ваше отражение, а ваши величайшие ошибки.", "Играйте при столкновении с прошлым или поиске искупления.",
     "Дзеркало Жалю", "Дзеркало, що показує не ваше відображення, а ваші найбільші помилки.", "Грайте при зіткненні з минулим або пошуку спокути."),
    ("The Key to the End", "An implement that can unlock any door, including the final one.", "Introduce when access or endings are at stake.",
     "Ключ к Концу", "Инструмент, способный открыть любую дверь, включая последнюю.", "Вводите, когда доступ или концовки на кону.",
     "Ключ до Кінця", "Інструмент, здатний відкрити будь-які двері, включаючи останні.", "Вводьте, коли доступ або кінцівки на кону."),
    ("The Cloak of Shadows", "A garment that grants invisibility and passage through darkness.", "Use when stealth or concealment is needed.",
     "Плащ Теней", "Одежда, дарующая невидимость и проход сквозь тьму.", "Используйте, когда нужны скрытность или маскировка.",
     "Плащ Тіней", "Одяг, що дарує невидимість і прохід крізь темряву.", "Використовуйте, коли потрібні скритність або маскування."),
    ("The Coin That Decides Fate", "A piece of currency that, when flipped, determines destiny itself.", "Play when chance and fate must be tested.",
     "Монета, Решающая Судьбу", "Монета, которая при подбрасывании определяет саму судьбу.", "Играйте, когда шанс и судьба должны быть испытаны.",
     "Монета, Що Вирішує Долю", "Монета, яка при підкиданні визначає саму долю.", "Грайте, коли шанс і доля повинні бути випробувані."),
    ("The Bone Flute", "An instrument carved from remains that plays songs of death and sorrow.", "Introduce when music has dark power.",
     "Костяная Флейта", "Инструмент, вырезанный из останков, играющий песни смерти и печали.", "Вводите, когда музыка имеет темную силу.",
     "Кістяна Флейта", "Інструмент, вирізаний з останків, що грає пісні смерті і печалі.", "Вводьте, коли музика має темну силу."),
    ("The Phoenix Feather", "A plume from the immortal bird, granting rebirth or resurrection.", "Use when death can be overcome or renewal is possible.",
     "Перо Феникса", "Перо бессмертной птицы, дарующее возрождение или воскрешение.", "Используйте, когда смерть может быть преодолена или возможно обновление.",
     "Перо Фенікса", "Перо безсмертного птаха, що дарує відродження або воскресіння.", "Використовуйте, коли смерть може бути подолана або можливе оновлення."),
    ("The Hourglass of Undoing", "A timepiece that can reverse moments or extend them indefinitely.", "Play when time manipulation is needed.",
     "Песочные Часы Отмены", "Часы, способные обращать моменты вспять или продлевать их бесконечно.", "Играйте, когда нужна манипуляция временем.",
     "Пісочний Годинник Скасування", "Годинник, здатний звертати моменти назад або продовжувати їх нескінченно.", "Грайте, коли потрібна маніпуляція часом."),
    ("The Mask of Many Faces", "A disguise that allows the wearer to become anyone they choose.", "Introduce when identity is fluid or deception is key.",
     "Маска Многих Лиц", "Маскировка, позволяющая носящему стать кем угодно по своему выбору.", "Вводите, когда идентичность текуча или обман является ключевым.",
     "Маска Багатьох Облич", "Маскування, що дозволяє носію стати ким завгодно за своїм вибором.", "Вводьте, коли ідентичність плинна або обман є ключовим."),
    ("The Compass That Points to Danger", "A navigation tool that always indicates the nearest threat.", "Use when seeking trouble or avoiding it.",
     "Компас, Указывающий на Опасность", "Навигационный инструмент, всегда указывающий на ближайшую угрозу.", "Используйте при поиске неприятностей или их избегании.",
     "Компас, Що Вказує на Небезпеку", "Навігаційний інструмент, що завжди вказує на найближчу загрозу.", "Використовуйте при пошуку неприємностей або їх уникненні."),
    ("The Seed of the World Tree", "A kernel containing the potential for infinite growth and life.", "Play when creation or renewal is the theme.",
     "Семя Мирового Древа", "Зерно, содержащее потенциал для бесконечного роста и жизни.", "Играйте, когда созидание или обновление являются темой.",
     "Насіння Світового Дерева", "Зерно, що містить потенціал для нескінченного росту і життя.", "Грайте, коли творення або оновлення є темою."),
    ("The Chain of Promises", "Links forged from vows that bind those who swear upon them.", "Introduce when oaths and their keeping matter.",
     "Цепь Обещаний", "Звенья, выкованные из клятв, связывающие тех, кто на них клянется.", "Вводите, когда клятвы и их соблюдение имеют значение.",
     "Ланцюг Обіцянок", "Ланки, викувані з клятв, що пов'язують тих, хто на них клянеться.", "Вводьте, коли клятви та їх дотримання мають значення."),
    ("The Gem of Nightfall", "A jewel that brings darkness wherever it goes.", "Use when shadow and night are needed.",
     "Самоцвет Сумерек", "Драгоценный камень, приносящий тьму, куда бы он ни попал.", "Используйте, когда нужны тень и ночь.",
     "Самоцвіт Сутінків", "Дорогоцінний камінь, що приносить темряву, куди б він не потрапив.", "Використовуйте, коли потрібні тінь і ніч."),
    ("The Blade That Hungers", "A weapon with a will of its own, demanding blood and battle.", "Play when weapons have dangerous sentience.",
     "Клинок, Который Жаждет", "Оружие с собственной волей, требующее крови и битвы.", "Играйте, когда оружие обладает опасным разумом.",
     "Лезо, Що Жадає", "Зброя з власною волею, що вимагає крові і битви.", "Грайте, коли зброя має небезпечний розум."),
    ("The Scroll of Names", "A document listing all who live, and when crossed out, they die.", "Introduce when names have power over life and death.",
     "Свиток Имен", "Документ, перечисляющий всех живущих; если имя вычеркнуть, человек умирает.", "Вводите, когда имена имеют власть над жизнью и смертью.",
     "Сувій Імен", "Документ, що перераховує всіх живих; якщо ім'я викреслити, людина помирає. ", "Вводьте, коли імена мають владу над життям і смертю."),
    ("The Crown of Thorns", "A painful symbol of martyrdom that grants power through suffering.", "Use when sacrifice and pain lead to strength.",
     "Терновый Венец", "Болезненный символ мученичества, дарующий силу через страдание.", "Используйте, когда жертва и боль ведут к силе.",
     "Терновий Вінець", "Болісний символ мучеництва, що дарує силу через страждання.", "Використовуйте, коли жертва і біль ведуть до сили."),
    ("The Bell of Awakening", "A chime that rouses the sleeping, whether from slumber or death.", "Play when awakening or resurrection is needed.",
     "Колокол Пробуждения", "Звон, пробуждающий спящих, будь то ото сна или от смерти.", "Играйте, когда нужно пробуждение или воскрешение.",
     "Дзвін Пробудження", "Дзвін, що пробуджує сплячих, будь то від сну або від смерті.", "Грайте, коли потрібне пробудження або воскресіння."),
    ("The Lantern That Burns Cold", "A light that freezes rather than warms, illuminating with ice.", "Introduce when cold and preservation are themes.",
     "Фонарь, Горящий Холодом", "Свет, который замораживает, а не греет, освещая льдом.", "Вводите, когда холод и сохранение являются темами.",
     "Ліхтар, Що Горить Холодом", "Світло, яке заморожує, а не гріє, освітлюючи льодом.", "Вводьте, коли холод і збереження є темами."),
    ("The Stone That Speaks", "A rock that whispers secrets and ancient knowledge to those who listen.", "Use when seeking hidden information.",
     "Говорящий Камень", "Камень, шепчущий секреты и древние знания тем, кто слушает.", "Используйте при поиске скрытой информации.",
     "Камінь, Що Говорить", "Камінь, що шепоче секрети і стародавні знання тим, хто слухає.", "Використовуйте при пошуку прихованої інформації."),
    ("The Puzzle Box", "A container that can only be opened by solving its intricate mechanism.", "Play when cleverness is required to proceed.",
     "Шкатулка-Головоломка", "Контейнер, который можно открыть, только разгадав его сложный механизм.", "Играйте, когда требуется сообразительность, чтобы продвинуться.",
     "Скринька-Головоломка", "Контейнер, який можна відкрити, тільки розгадавши його складний механізм.", "Грайте, коли потрібна кмітливість, щоб просунутися."),
    ("The Heart of the Machine", "The core component that gives life to mechanical constructs.", "Introduce when dealing with artificial life or technology.",
     "Сердце Машины", "Основной компонент, дающий жизнь механическим конструкциям.", "Вводите, когда имеете дело с искусственной жизнью или технологиями.",
     "Серце Машини", "Основний компонент, що дає життя механічним конструкціям.", "Вводьте, коли маєте справу зі штучним життям або технологіями."),
    ("The Thorned Rose", "A beautiful flower that draws blood from those who grasp it.", "Use when beauty and danger are intertwined.",
     "Шипастая Роза", "Прекрасный цветок, пьющий кровь тех, кто его срывает.", "Используйте, когда красота и опасность переплетены.",
     "Шипаста Троянда", "Прекрасна квітка, що п'є кров тих, хто її зриває.", "Використовуйте, коли краса і небезпека переплетені."),
    ("The Whispering Locket", "A pendant that contains voices of the departed.", "Play when the dead have messages for the living.",
     "Шепчущий Медальон", "Кулон, содержащий голоса усопших.", "Играйте, когда у мертвых есть послания для живых.",
     "Медальйон, Що Шепоче", "Кулон, що містить голоси покійних.", "Грайте, коли у мертвих є послання для живих."),
    ("The Egg That Never Hatches", "A mysterious shell containing something that refuses to be born.", "Introduce when potential remains forever unrealized.",
     "Яйцо, Которое Никогда Не Вылупится", "Таинственная оболочка, содержащая что-то, что отказывается рождаться.", "Вводите, когда потенциал остается навсегда нереализованным.",
     "Яйце, Що Ніколи Не Вилупиться", "Таємнича оболонка, що містить щось, що відмовляється народжуватися.", "Вводьте, коли потенціал залишається назавжди нереалізованим."),
]

catalysts = [
    ("A Prophecy Revealed", "Ancient words foretelling the future come to light, changing everything.", "Use to introduce destiny or set events in motion.",
     "Раскрытое Пророчество", "Древние слова, предсказывающие будущее, выходят на свет, меняя все.", "Используйте, чтобы ввести судьбу или запустить события.",
     "Розкрите Пророцтво", "Стародавні слова, що пророкують майбутнє, виходять на світло, змінюючи все.", "Використовуйте, щоб ввести долю або запустити події."),
    ("A Secret Uncovered", "Hidden truth comes to light, shattering assumptions and trust.", "Play when revelations change the story.",
     "Раскрытая Тайна", "Скрытая правда выходит на свет, разрушая предположения и доверие.", "Играйте, когда откровения меняют историю.",
     "Розкрита Таємниця", "Прихована правда виходить на світло, руйнуючи припущення і довіру.", "Грайте, коли одкровення змінюють історію."),
    ("A Rescue Attempt", "Someone tries to save another from danger, for better or worse.", "Introduce when heroism or desperation drives action.",
     "Попытка Спасения", "Кто-то пытается спасти другого от опасности, к лучшему или к худшему.", "Вводите, когда героизм или отчаяние движут действиями.",
     "Спроба Порятунку", "Хтось намагається врятувати іншого від небезпеки, на краще чи на гірше.", "Вводьте, коли героїзм або відчай рухають діями."),
    ("A Sudden Betrayal", "Trust is shattered as an ally reveals their true allegiance.", "Use when shocking turns are needed.",
     "Внезапное Предательство", "Доверие разрушено, когда союзник раскрывает свою истинную преданность.", "Используйте, когда нужны шокирующие повороты.",
     "Раптова Зрада", "Довіра зруйнована, коли союзник розкриває свою справжню відданість.", "Використовуйте, коли потрібні шокуючі повороти."),
    ("A Forbidden Love", "Hearts connect across boundaries that should never be crossed.", "Play when romance complicates everything.",
     "Запретная Любовь", "Сердца соединяются через границы, которые никогда не должны быть пересечены.", "Играйте, когда романтика все усложняет.",
     "Заборонене Кохання", "Серця з'єднуються через кордони, які ніколи не повинні бути перетнуті.", "Грайте, коли романтика все ускладнює."),
    ("A Duel at Dawn", "Two opponents face each other in formal combat to settle their dispute.", "Introduce when honor demands satisfaction.",
     "Дуэль на Рассвете", "Два противника сталкиваются в формальном бою, чтобы разрешить свой спор.", "Вводите, когда честь требует сатисфакции.",
     "Дуель на Світанку", "Два супротивники стикаються у формальному бою, щоб вирішити свою суперечку.", "Вводьте, коли честь вимагає сатисфакції."),
    ("A Message from the Past", "Communication from another time arrives, bearing crucial information.", "Use when history speaks to the present.",
     "Послание из Прошлого", "Приходит сообщение из другого времени, несущее важную информацию.", "Используйте, когда история говорит с настоящим.",
     "Послання з Минулого", "Приходить повідомлення з іншого часу, що несе важливу інформацію.", "Використовуйте, коли історія говорить із сьогоденням."),
    ("A Stranger Arrives", "An unknown person appears, bringing change and mystery.", "Play when new elements enter the story.",
     "Прибытие Незнакомца", "Появляется неизвестный человек, принося перемены и тайну.", "Играйте, когда новые элементы входят в историю.",
     "Прибуття Незнайомця", "З'являється невідома людина, приносячи зміни і таємницю.", "Грайте, коли нові елементи входять в історію."),
    ("A Door Appears", "A portal or passage manifests where none existed before.", "Introduce when new paths open.",
     "Появление Двери", "Портал или проход проявляется там, где раньше ничего не было.", "Вводите, когда открываются новые пути.",
     "Поява Дверей", "Портал або прохід проявляється там, де раніше нічого не було.", "Вводьте, коли відкриваються нові шляхи."),
    ("A Dream Foretold", "A vision in sleep proves to be prophetic or significant.", "Use when the subconscious reveals truth.",
     "Предсказанный Сон", "Видение во сне оказывается пророческим или значимым.", "Используйте, когда подсознание раскрывает правду.",
     "Передбачений Сон", "Видіння уві сні виявляється пророчим або значущим.", "Використовуйте, коли підсвідомість розкриває правду."),
    ("A Pact is Broken", "An agreement is violated, releasing consequences.", "Play when oaths fail and chaos follows.",
     "Нарушенный Договор", "Соглашение нарушено, высвобождая последствия.", "Играйте, когда клятвы рушатся и следует хаос.",
     "Порушений Договір", "Угода порушена, вивільняючи наслідки. ", "Грайте, коли клятви руйнуються і слідує хаос."),
    ("A Festival Begins", "Celebration commences, providing cover for plots or joy before disaster.", "Introduce when gathering and festivity matter.",
     "Начало Фестиваля", "Начинается празднование, обеспечивающее прикрытие для заговоров или радость перед катастрофой.", "Вводите, когда собрания и празднества имеют значение.",
     "Початок Фестивалю", "Починається святкування, що забезпечує прикриття для змов або радість перед катастрофою.", "Вводьте, коли зібрання та святкування мають значення."),
    ("A War Ignites", "Conflict erupts into open warfare, consuming all in its path.", "Use when peace ends and battle begins.",
     "Вспыхивает Война", "Конфликт перерастает в открытую войну, поглощающую все на своем пути.", "Используйте, когда мир заканчивается и начинается битва.",
     "Спалахує Війна", "Конфлікт переростає у відкриту війну, що поглинає все на своєму шляху.", "Використовуйте, коли мир закінчується і починається битва."),
    ("A Storm Approaches", "Dark weather heralds coming danger or change.", "Play when omens appear in nature.",
     "Приближение Бури", "Темная погода предвещает грядущую опасность или перемены.", "Играйте, когда знамения появляются в природе.",
     "Наближення Бурі", "Темна погода віщує майбутню небезпеку або зміни.", "Грайте, коли знамення з'являються в природі."),
    ("A Child is Born", "New life enters the world, bringing hope or prophecy.", "Introduce when birth changes everything.",
     "Рождение Ребенка", "Новая жизнь входит в мир, принося надежду или пророчество.", "Вводите, когда рождение меняет все.",
     "Народження Дитини", "Нове життя входить у світ, приносячи надію або пророцтво.", "Вводьте, коли народження змінює все."),
    ("A Hero Falls", "A great champion is defeated or dies, leaving a void.", "Use when loss drives the narrative.",
     "Падение Героя", "Великий чемпион побежден или умирает, оставляя пустоту.", "Используйте, когда потеря движет повествование.",
     "Падіння Героя", "Великий чемпіон переможений або помирає, залишаючи порожнечу.", "Використовуйте, коли втрата рухає розповідь."),
    ("A Truth is Denied", "Reality is rejected, leading to dangerous self-deception.", "Play when characters refuse to see what is.",
     "Отрицание Истины", "Реальность отвергается, что ведет к опасному самообману.", "Играйте, когда персонажи отказываются видеть то, что есть.",
     "Заперечення Істини", "Реальність відкидається, що веде до небезпечного самообману.", "Грайте, коли персонажі відмовляються бачити те, що є."),
    ("A Monster Awakens", "A terrible creature stirs from slumber, threatening all.", "Introduce when ancient threats return.",
     "Пробуждение Монстра", "Ужасное существо пробуждается от сна, угрожая всем.", "Вводите, когда древние угрозы возвращаются.",
     "Пробудження Монстра", "Жахлива істота прокидається від сну, погрожуючи всім.", "Вводьте, коли стародавні загрози повертаються."),
    ("A Spell Backfires", "Magic goes wrong, creating unintended consequences.", "Use when power escapes control.",
     "Заклинание Дает Осечку", "Магия идет не так, создавая непреднамеренные последствия.", "Используйте, когда сила выходит из-под контроля.",
     "Заклинання Дає Осічку", "Магія йде не так, створюючи ненавмисні наслідки.", "Використовуйте, коли сила виходить з-під контролю."),
    ("A Clock Strikes Thirteen", "Time behaves impossibly, signaling something is wrong.", "Play when reality breaks down.",
     "Часы Бьют Тринадцать", "Время ведет себя невозможно, сигнализируя, что что-то не так.", "Играйте, когда реальность ломается.",
     "Годинник Б'є Тринадцять", "Час поводиться неможливо, сигналізуючи, що щось не так.", "Грайте, коли реальність ламається."),
    ("A Mask is Removed", "True identity is revealed, for good or ill.", "Introduce when deception ends.",
     "Маска Снята", "Истинная личность раскрыта, к добру или к худу.", "Вводите, когда обман заканчивается.",
     "Маска Знята", "Справжня особистість розкрита, до добра чи до лиха.", "Вводьте, коли обман закінчується."),
    ("A Sacrifice is Made", "Someone gives up something precious for a greater cause.", "Use when cost and value collide.",
     "Принесена Жертва", "Кто-то отказывается от чего-то драгоценного ради великой цели.", "Используйте, когда цена и ценность сталкиваются.",
     "Принесена Жертва", "Хтось відмовляється від чогось дорогоцінного заради великої мети.", "Використовуйте, коли ціна і цінність стикаються."),
    ("A Prison is Breached", "Captives escape or invaders break through defenses.", "Play when containment fails.",
     "Тюрьма Взломана", "Пленники сбегают или захватчики прорываются через защиту.", "Играйте, когда сдерживание не удается.",
     "В'язниця Зламана", "Полонені тікають або загарбники прориваються через захист.", "Грайте, коли стримування не вдається."),
    ("A Trial is Called", "Judgment is demanded, and truth must be determined.", "Introduce when justice is sought.",
     "Назначен Суд", "Требуется правосудие, и истина должна быть установлена.", "Вводите, когда ищется справедливость.",
     "Призначено Суд", "Вимагається правосуддя, і істина повинна бути встановлена.", "Вводьте, коли шукається справедливість."),
    ("A God Demands Tribute", "Divine power requires payment or worship.", "Use when the sacred makes demands.",
     "Бог Требует Дани", "Божественная сила требует платы или поклонения.", "Используйте, когда священное предъявляет требования.",
     "Бог Вимагає Данини", "Божественна сила вимагає плати або поклоніння.", "Використовуйте, коли священне висуває вимоги."),
    ("A Friend is Lost", "A companion disappears, dies, or is taken.", "Play when grief drives action.",
     "Потеря Друга", "Спутник исчезает, умирает или похищен.", "Играйте, когда горе движет действиями.",
     "Втрата Друга", "Супутник зникає, помирає або викрадений.", "Грайте, коли горе рухає діями."),
    ("A New Power Rises", "A force or person gains strength and influence.", "Introduce when the balance shifts.",
     "Восстание Новой Силы", "Сила или человек набирает мощь и влияние.", "Вводите, когда баланс смещается.",
     "Повстання Нової Сили", "Сила або людина набирає міць і вплив.", "Вводьте, коли баланс зміщується."),
    ("A Letter is Delivered", "Written words arrive, carrying news that changes plans.", "Use when communication alters the course.",
     "Письмо Доставлено", "Приходят письменные слова, несущие новости, которые меняют планы.", "Используйте, когда общение меняет курс.",
     "Лист Доставлено", "Приходять письмові слова, що несуть новини, які змінюють плани.", "Використовуйте, коли спілкування змінює курс."),
    ("A Weapon is Found", "A tool of power is discovered, offering new possibilities.", "Play when means become available.",
     "Оружие Найдено", "Обнаружен инструмент силы, предлагающий новые возможности.", "Играйте, когда средства становятся доступными.",
     "Зброю Знайдено", "Виявлено інструмент сили, що пропонує нові можливості.", "Грайте, коли засоби стають доступними."),
    ("A Memory Returns", "Forgotten knowledge resurfaces, illuminating the present.", "Introduce when the past clarifies now.",
     "Возвращение Памяти", "Забытое знание всплывает, освещая настоящее.", "Вводите, когда прошлое проясняет «сейчас».",
     "Повернення Пам'яті", "Забуте знання спливає, висвітлюючи сьогодення.", "Вводьте, коли минуле прояснює «зараз»."),
    ("A Portal Opens", "A gateway between places or worlds becomes accessible.", "Use when travel or invasion begins.",
     "Открытие Портала", "Врата между местами или мирами становятся доступными.", "Используйте, когда начинается путешествие или вторжение.",
     "Відкриття Порталу", "Брама між місцями або світами стає доступною.", "Використовуйте, коли починається подорож або вторгнення."),
    ("A Curse is Cast", "Dark magic is invoked, bringing misfortune.", "Play when supernatural doom arrives.",
     "Наложено Проклятие", "Темная магия призвана, принося несчастье.", "Играйте, когда сверхъестественный рок прибывает.",
     "Накладено Прокляття", "Темна магія призвана, приносячи нещастя.", "Грайте, коли надприродний фатум прибуває."),
    ("A Kingdom Crumbles", "Political power collapses, creating chaos.", "Introduce when order fails.",
     "Королевство Рушится", "Политическая власть рушится, создавая хаос.", "Вводите, когда порядок терпит неудачу.",
     "Королівство Руйнується", "Політична влада руйнується, створюючи хаос.", "Вводьте, коли порядок зазнає невдачі."),
    ("A Stranger is Trusted", "Faith is placed in an unknown person, with uncertain results.", "Use when risk and hope combine.",
     "Доверие Незнакомцу", "Вера возлагается на неизвестного человека с неопределенными результатами.", "Используйте, когда риск и надежда сочетаются.",
     "Довіра Незнайомцю", "Віра покладається на невідому людину з невизначеними результатами.", "Використовуйте, коли ризик і надія поєднуються."),
    ("A Lie is Believed", "Falsehood is accepted as truth, leading astray.", "Play when deception succeeds.",
     "Вера в Ложь", "Ложь принимается за правду, уводя в сторону.", "Играйте, когда обман удается.",
     "Віра в Брехню", "Брехня приймається за правду, ведучи вбік.", "Грайте, коли обман вдається."),
    ("A Fire Spreads", "Flames consume, destroying or purifying.", "Introduce when destruction advances.",
     "Огонь Распространяется", "Пламя пожирает, уничтожая или очищая.", "Вводите, когда разрушение наступает.",
     "Вогонь Поширюється", "Полум'я пожирає, знищуючи або очищаючи.", "Вводьте, коли руйнування настає."),
    ("A Deal is Struck", "An agreement is made, binding parties to its terms.", "Use when bargains shape fate.",
     "Сделка Заключена", "Соглашение достигнуто, связывая стороны его условиями.", "Используйте, когда сделки формируют судьбу.",
     "Угода Укладена", "Угода досягнута, пов'язуючи сторони її умовами.", "Використовуйте, коли угоди формують долю."),
    ("A Secret Passage Found", "A hidden way is discovered, offering escape or infiltration.", "Play when new routes appear.",
     "Найден Тайный Проход", "Обнаружен скрытый путь, предлагающий побег или проникновение.", "Играйте, когда появляются новые маршруты.",
     "Знайдено Таємний Прохід", "Виявлено прихований шлях, що пропонує втечу або проникнення.", "Грайте, коли з'являються нові маршрути."),
    ("A Song is Sung", "Music is performed, carrying power or emotion.", "Introduce when art affects reality.",
     "Песня Спета", "Музыка исполняется, неся силу или эмоции.", "Вводите, когда искусство влияет на реальность.",
     "Пісня Заспівана", "Музика виконується, несучи силу або емоції.", "Вводьте, коли мистецтво впливає на реальність."),
    ("A Choice Must Be Made", "A decision point arrives where the path forward diverges.", "Use when free will determines destiny.",
     "Выбор Должен Быть Сделан", "Наступает момент решения, где путь вперед расходится.", "Используйте, когда свободная воля определяет судьбу.",
     "Вибір Повинен Бути Зроблений", "Настає момент рішення, де шлях вперед розходиться.", "Використовуйте, коли вільна воля визначає долю."),
]

traits = [
    ("Bravery in Doubt", "Courage that persists even when fear and uncertainty threaten to overwhelm.", "Use when characters must act despite their fears.",
     "Храбрость в Сомнении", "Мужество, которое сохраняется, даже когда страх и неуверенность грозят переполнить.", "Используйте, когда персонажи должны действовать вопреки своим страхам.",
     "Хоробрість у Сумніві", "Мужність, що зберігається, навіть коли страх і невпевненість загрожують переповнити.", "Використовуйте, коли персонажі повинні діяти всупереч своїм страхам."),
    ("Greed Unleashed", "Insatiable desire for wealth or power that consumes all other concerns.", "Play when avarice drives destructive behavior.",
     "Развязанная Жадность", "Ненасытное желание богатства или власти, поглощающее все остальные заботы.", "Играйте, когда алчность движет разрушительным поведением.",
     "Розв'язана Жадібність", "Ненаситне бажання багатства або влади, що поглинає всі інші турботи.", "Грайте, коли жадібність рухає руйнівною поведінкою."),
    ("Hope Rekindled", "The return of optimism after it seemed lost forever.", "Introduce when light appears in darkness.",
     "Возрожденная Надежда", "Возвращение оптимизма после того, как он казался потерянным навсегда.", "Вводите, когда свет появляется во тьме.",
     "Відроджена Надія", "Повернення оптимізму після того, як він здавався втраченим назавжди.", "Вводьте, коли світло з'являється в темряві."),
    ("Loneliness Echoed", "Profound isolation that resonates through actions and choices.", "Use when exploring solitude and its effects.",
     "Эхо Одиночества", "Глубокая изоляция, резонирующая через действия и выбор.", "Используйте при исследовании одиночества и его последствий.",
     "Відлуння Самотності", "Глибока ізоляція, що резонує через дії та вибір.", "Використовуйте при дослідженні самотності та її наслідків."),
    ("Love Unspoken", "Deep affection that remains unexpressed, shaping events from silence.", "Play when hidden feelings matter.",
     "Невысказанная Любовь", "Глубокая привязанность, остающаяся невыраженной, формирующая события из тишины.", "Играйте, когда скрытые чувства имеют значение.",
     "Невисловлене Кохання", "Глибока прихильність, що залишається невираженою, формуючи події з тиші.", "Грайте, коли приховані почуття мають значення."),
    ("Pride Before the Fall", "Arrogance that leads inevitably to downfall.", "Introduce when hubris precedes disaster.",
     "Гордыня перед Падением", "Высокомерие, неизбежно ведущее к краху.", "Вводите, когда гордыня предшествует катастрофе.",
     "Гординя перед Падінням", "Зарозумілість, що неминуче веде до краху.", "Вводьте, коли гординя передує катастрофі."),
    ("Redemption Sought", "The active pursuit of forgiveness and restoration after wrongdoing.", "Use when characters seek to atone.",
     "Поиск Искупления", "Активное стремление к прощению и восстановлению после проступка.", "Используйте, когда персонажи стремятся искупить вину.",
     "Пошук Спокути", "Активне прагнення до прощення та відновлення після проступку.", "Використовуйте, коли персонажі прагнуть спокутувати провину."),
    ("Trust Betrayed", "The shattering of faith in another, leaving deep wounds.", "Play when loyalty is violated.",
     "Преданное Доверие", "Разрушение веры в другого, оставляющее глубокие раны.", "Играйте, когда верность нарушена.",
     "Зраджена Довіра", "Руйнування віри в іншого, що залишає глибокі рани. ", "Грайте, коли вірність порушена."),
    ("Duty Over Desire", "Obligation chosen above personal wants and needs.", "Introduce when sacrifice is required.",
     "Долг Превыше Желания", "Обязательство, выбранное вместо личных желаний и потребностей.", "Вводите, когда требуется жертва.",
     "Обов'язок Понад Бажання", "Зобов'язання, обране замість особистих бажань і потреб.", "Вводьте, коли потрібна жертва."),
    ("Fear of the Unknown", "Terror of what cannot be seen or understood.", "Use when mystery breeds dread.",
     "Страх Неизвестного", "Ужас перед тем, что нельзя увидеть или понять.", "Используйте, когда тайна порождает страх.",
     "Страх Невідомого", "Жах перед тим, що не можна побачити або зрозуміти.", "Використовуйте, коли таємниця породжує страх."),
    ("Ambition Without End", "Drive to achieve that knows no limits or satisfaction.", "Play when aspiration becomes dangerous.",
     "Бесконечные Амбиции", "Стремление к достижениям, не знающее границ или удовлетворения.", "Играйте, когда стремление становится опасным.",
     "Нескінченні Амбіції", "Прагнення до досягнень, що не знає меж або задоволення.", "Грайте, коли прагнення стає небезпечним."),
    ("Kindness in Darkness", "Compassion that shines even in the bleakest circumstances.", "Introduce when goodness persists.",
     "Доброта во Тьме", "Сострадание, которое сияет даже в самых мрачных обстоятельствах.", "Вводите, когда доброта сохраняется.",
     "Доброта у Темряві", "Співчуття, що сяє навіть у найпохмуріших обставинах. ", "Вводьте, коли доброта зберігається."),
    ("Guilt That Festers", "Remorse that grows and corrupts over time.", "Use when past wrongs haunt the present.",
     "Гложущая Вина", "Раскаяние, которое растет и развращает со временем.", "Используйте, когда прошлые ошибки преследуют настоящее.",
     "Провина, Що Гризе", "Каяття, що росте і розбещує з часом.", "Використовуйте, коли минулі помилки переслідують сьогодення."),
    ("Joy in Small Things", "The ability to find happiness in simple pleasures.", "Play when appreciation matters.",
     "Радость в Мелочах", "Способность находить счастье в простых удовольствиях.", "Играйте, когда важна признательность.",
     "Радість у Дрібницях", "Здатність знаходити щастя в простих задоволеннях.", "Грайте, коли важлива вдячність."),
    ("Rage Unleashed", "Fury that breaks free and consumes everything.", "Introduce when anger takes control.",
     "Развязанная Ярость", "Гнев, который вырывается на свободу и поглощает все.", "Вводите, когда гнев берет контроль.",
     "Розв'язана Лють", "Гнів, що виривається на волю і поглинає все.", "Вводьте, коли гнів бере контроль."),
    ("Honor Above All", "Integrity maintained regardless of cost.", "Use when principles are tested.",
     "Честь Превыше Всего", "Честность сохраняется независимо от цены.", "Используйте, когда принципы подвергаются испытанию.",
     "Честь Понад Усе", "Чесність зберігається незалежно від ціни.", "Використовуйте, коли принципи піддаються випробуванню."),
    ("Curiosity Unchecked", "The desire to know that leads into danger.", "Play when investigation brings peril.",
     "Необузданное Любопытство", "Желание знать, ведущее к опасности.", "Играйте, когда расследование приносит беду.",
     "Нестримна Допитливість", "Бажання знати, що веде до небезпеки.", "Грайте, коли розслідування приносить біду."),
    ("Faith in the Impossible", "Belief that persists despite all evidence to the contrary.", "Introduce when hope defies reason.",
     "Вера в Невозможное", "Убеждение, которое сохраняется вопреки всем доказательствам обратного.", "Вводите, когда надежда бросает вызов разуму.",
     "Віра в Неможливе", "Переконання, що зберігається всупереч усім доказам зворотного.", "Вводьте, коли надія кидає виклик розуму."),
    ("Regret That Haunts", "Sorrow over past choices that cannot be escaped.", "Use when the past weighs heavily.",
     "Преследующее Сожаление", "Печаль о прошлом выборе, от которого нельзя убежать.", "Используйте, когда прошлое тяжело давит.",
     "Жаль, Що Переслідує", "Печаль про минулий вибір, від якого не можна втекти.", "Використовуйте, коли минуле важко тисне."),
    ("Sacrifice for Love", "Giving up what matters most for those we cherish.", "Play when love demands everything.",
     "Жертва ради Любви", "Отказ от самого важного ради тех, кого мы дорожим.", "Играйте, когда любовь требует всего.",
     "Жертва заради Любові", "Відмова від найважливішого заради тих, кого ми цінуємо.", "Грайте, коли любов вимагає всього."),
    ("Obsession Consumes", "Single-minded focus that destroys balance and reason.", "Introduce when fixation becomes destructive.",
     "Поглощающая Одержимость", "Однонаправленная концентрация, разрушающая баланс и разум.", "Вводите, когда фиксация становится разрушительной.",
     "Одержимість, Що Поглинає", "Односпрямована концентрація, що руйнує баланс і розум.", "Вводьте, коли фіксація стає руйнівною."),
    ("Loyalty Beyond Death", "Faithfulness that transcends even mortality.", "Use when devotion knows no bounds.",
     "Верность за Гранью Смерти", "Преданность, превосходящая даже смертность.", "Используйте, когда преданность не знает границ.",
     "Вірність за Межею Смерті", "Відданість, що перевершує навіть смертність.", "Використовуйте, коли відданість не знає меж."),
    ("Innocence Lost", "The painful transition from naivety to harsh awareness.", "Play when corruption of purity occurs.",
     "Потерянная Невинность", "Болезненный переход от наивности к суровому осознанию.", "Играйте, когда происходит развращение чистоты.",
     "Втрачена Невинність", "Болісний перехід від наївності до суворого усвідомлення.", "Грайте, коли відбувається розбещення чистоти."),
    ("Courage in Silence", "Bravery expressed through quiet endurance rather than bold action.", "Introduce when strength is subtle.",
     "Мужество в Тишине", "Храбрость, выраженная через тихое терпение, а не смелые действия.", "Вводите, когда сила тонка.",
     "Мужність у Тиші", "Хоробрість, виражена через тихе терпіння, а не сміливі дії.", "Вводьте, коли сила тонка."),
    ("Grief That Transforms", "Sorrow that changes the mourner fundamentally.", "Use when loss reshapes identity.",
     "Горе, Которое Трансформирует", "Печаль, которая фундаментально меняет скорбящего.", "Используйте, когда потеря меняет идентичность.",
     "Горе, Що Трансформує", "Печаль, яка фундаментально змінює скорботного.", "Використовуйте, коли втрата змінює ідентичність."),
    ("Arrogance Punished", "Pride meeting its inevitable consequences.", "Play when comeuppance arrives.",
     "Наказанное Высокомерие", "Гордыня встречает свои неизбежные последствия.", "Играйте, когда наступает возмездие.",
     "Покарана Зарозумілість", "Гординя зустрічає свої неминучі наслідки.", "Грайте, коли настає відплата."),
    ("Forgiveness Given", "The grace of pardoning wrongs done.", "Introduce when mercy is offered.",
     "Дарованное Прощение", "Благодать прощения совершенных проступков.", "Вводите, когда предлагается милосердие.",
     "Дароване Прощення", "Благодать прощення скоєних проступків.", "Вводьте, коли пропонується милосердя."),
    ("Despair Overcome", "The triumph of will over hopelessness.", "Use when darkness is defeated.",
     "Преодоленное Отчаяние", "Триумф воли над безнадежностью.", "Используйте, когда тьма побеждена.",
     "Подоланий Відчай", "Тріумф волі над безнадійністю.", "Використовуйте, коли темрява переможена."),
    ("Vengeance Taken", "Retribution claimed for wrongs suffered.", "Play when justice or revenge is served.",
     "Свершившаяся Месть", "Возмездие за перенесенные страдания.", "Играйте, когда свершается правосудие или месть.",
     "Здійснена Помста", "Відплата за перенесені страждання.", "Грайте, коли здійснюється правосуддя або помста."),
    ("Wonder Rekindled", "The return of amazement and appreciation for the extraordinary.", "Introduce when magic returns to life.",
     "Возрожденное Чудо", "Возвращение изумления и признательности за необычное.", "Вводите, когда магия возвращается к жизни.",
     "Відроджене Диво", "Повернення подиву і вдячності за незвичайне.", "Вводьте, коли магія повертається до життя."),
]

endings = [
    ("…and the monster was vanquished.", "The great evil is defeated, bringing victory to the heroes.", "Use for triumphant conclusions where good overcomes evil.",
     "…и монстр был побежден.", "Великое зло побеждено, принося победу героям.", "Используйте для триумфальных концовок, где добро побеждает зло.",
     "…і монстр був переможений.", "Велике зло переможене, приносячи перемогу героям.", "Використовуйте для тріумфальних кінцівок, де добро перемагає зло."),
    ("…but the hero lost everything.", "Victory came at a terrible price, leaving the champion broken.", "Play for pyrrhic victories or tragic sacrifices.",
     "…но герой потерял все.", "Победа досталась ужасной ценой, оставив чемпиона сломленным.", "Играйте для пирровых побед или трагических жертв.",
     "…але герой втратив усе.", "Перемога дісталася жахливою ціною, залишивши чемпіона зламаним.", "Грайте для піррових перемог або трагічних жертв."),
    ("…and harmony was restored.", "Balance and peace return to the world after conflict.", "Introduce when resolution brings equilibrium.",
     "…и гармония была восстановлена.", "Баланс и мир возвращаются в мир после конфликта.", "Вводите, когда разрешение приносит равновесие.",
     "…і гармонія була відновлена.", "Баланс і мир повертаються у світ після конфлікту.", "Вводьте, коли вирішення приносить рівновагу."),
    ("…yet the curse endured.", "Despite all efforts, the dark magic persists.", "Use for bittersweet or unresolved endings.",
     "…но проклятие осталось.", "Несмотря на все усилия, темная магия сохраняется.", "Используйте для горько-сладких или неразрешенных концовок.",
     "…але прокляття залишилося.", "Незважаючи на всі зусилля, темна магія зберігається.", "Використовуйте для гірко-солодких або невирішених кінцівок."),
    ("…and the journey changed them forever.", "The adventure transformed the travelers in fundamental ways.", "Play when growth and change are the true victory.",
     "…и путешествие изменило их навсегда.", "Приключение фундаментально изменило путешественников.", "Играйте, когда рост и изменения являются истинной победой.",
     "…і подорож змінила їх назавжди.", "Пригода фундаментально змінила мандрівників.", "Грайте, коли ріст і зміни є справжньою перемогою."),
    ("…but the truth was never spoken.", "Secrets remained buried, shaping the future from shadow.", "Introduce when silence defines the outcome.",
     "…но правда так и не была сказана.", "Секреты остались похороненными, формируя будущее из тени.", "Вводите, когда молчание определяет исход.",
     "…але правда так і не була сказана.", "Секрети залишилися похованими, формуючи майбутнє з тіні.", "Вводьте, коли мовчання визначає результат."),
    ("…and the kingdom was reborn.", "From ruin, a new and better realm emerges.", "Use for renewal and reconstruction.",
     "…и королевство возродилось.", "Из руин возникает новое и лучшее царство.", "Используйте для обновления и реконструкции.",
     "…і королівство відродилося.", "З руїн виникає нове і краще царство.", "Використовуйте для оновлення та реконструкції."),
    ("…and they vanished into legend.", "The heroes became myth, their truth lost to time.", "Play when history becomes story.",
     "…и они исчезли в легендах.", "Герои стали мифом, их правда потеряна во времени.", "Играйте, когда история становится сказкой.",
     "…і вони зникли в легендах.", "Герої стали міфом, їхня правда втрачена в часі.", "Грайте, коли історія стає казкою."),
    ("…but the price was too high.", "Success was achieved, but the cost was unbearable.", "Introduce when victory feels like defeat.",
     "…но цена была слишком высока.", "Успех был достигнут, но стоимость была невыносимой.", "Вводите, когда победа ощущается как поражение.",
     "…але ціна була занадто висока.", "Успіх був досягнутий, але вартість була нестерпною. ", "Вводьте, коли перемога відчувається як поразка."),
    ("…and the world forgot their name.", "Great deeds were done, but memory faded.", "Use for forgotten heroes and lost glory.",
     "…и мир забыл их имена.", "Великие дела были совершены, но память угасла.", "Используйте для забытых героев и потерянной славы.",
     "…і світ забув їхні імена.", "Великі справи були зроблені, але пам'ять згасла.", "Використовуйте для забутих героїв і втраченої слави."),
    ("…and peace returned at last.", "After long struggle, tranquility is finally achieved.", "Play for hard-won peaceful resolutions.",
     "…и мир вернулся наконец.", "После долгой борьбы спокойствие наконец достигнуто.", "Играйте для мирных решений, доставшихся с трудом.",
     "…і мир повернувся нарешті.", "Після довгої боротьби спокій нарешті досягнуто.", "Грайте для мирних рішень, що дісталися важкою працею."),
    ("…but the shadows still whispered.", "Darkness was pushed back but not eliminated.", "Introduce when evil lingers.",
     "…но тени все еще шептали.", "Тьма была отброшена, но не уничтожена.", "Вводите, когда зло задерживается.",
     "…але тіні все ще шепотіли.", "Темрява була відкинута, але не знищена. ", "Вводьте, коли зло затримується."),
    ("…and the stars sang once more.", "Joy and wonder return to a world that had forgotten them.", "Use for magical, uplifting conclusions.",
     "…и звезды запели вновь.", "Радость и чудо возвращаются в мир, который забыл их.", "Используйте для магических, вдохновляющих концовок.",
     "…і зірки заспівали знову.", "Радість і диво повертаються у світ, який забув їх.", "Використовуйте для магічних, надихаючих кінцівок."),
    ("…and the cycle began anew.", "The pattern repeats, for better or worse.", "Play for cyclical or eternal recurrence.",
     "…и цикл начался заново.", "Узор повторяется, к лучшему или к худшему.", "Играйте для циклических или вечных повторений.",
     "…і цикл почався заново.", "Візерунок повторюється, на краще чи на гірше.", "Грайте для циклічних або вічних повторень."),
    ("…but the hero never came home.", "The champion was lost in their quest.", "Introduce when sacrifice means never returning.",
     "…но герой так и не вернулся домой.", "Чемпион был потерян в своем поиске.", "Вводите, когда жертва означает невозвращение.",
     "…але герой так і не повернувся додому.", "Чемпіон був втрачений у своєму пошуку.", "Вводьте, коли жертва означає неповернення."),
    ("…and the story was passed on.", "The tale lives through those who tell it.", "Use when legacy is the true ending.",
     "…и история была передана дальше.", "Сказка живет через тех, кто ее рассказывает.", "Используйте, когда наследие является истинным концом.",
     "…і історія була передана далі.", "Казка живе через тих, хто її розповідає.", "Використовуйте, коли спадщина є справжнім кінцем."),
    ("…yet the wound never healed.", "Some injuries persist despite all attempts to mend them.", "Play for lasting trauma or permanent change.",
     "…но рана так и не зажила.", "Некоторые травмы сохраняются, несмотря на все попытки их исцелить.", "Играйте для длительной травмы или постоянных изменений.",
     "…але рана так і не загоїлася.", "Деякі травми зберігаються, незважаючи на всі спроби їх зцілити.", "Грайте для тривалої травми або постійних змін."),
    ("…and the light returned.", "Hope and brightness come back after darkness.", "Introduce for optimistic, healing conclusions.",
     "…и свет вернулся.", "Надежда и яркость возвращаются после тьмы.", "Вводите для оптимистичных, исцеляющих концовок.",
     "…і світло повернулося.", "Надія і яскравість повертаються після темряви.", "Вводьте для оптимістичних, зцілюючих кінцівок."),
    ("…but the silence remained.", "Quiet persists where there should be sound or life.", "Use for eerie or melancholic endings.",
     "…но тишина осталась.", "Спокойствие сохраняется там, где должен быть звук или жизнь.", "Используйте для жутких или меланхоличных концовок.",
     "…але тиша залишилася.", "Спокій зберігається там, де повинен бути звук або життя.", "Використовуйте для моторошних або меланхолійних кінцівок."),
    ("…and they lived, changed, ever after.", "Life continues, but those who lived it are forever altered.", "Play for realistic, transformative conclusions.",
     "…и они жили, изменившись, долго и счастливо.", "Жизнь продолжается, но те, кто ее прожил, навсегда изменились.", "Играйте для реалистичных, трансформирующих концовок.",
     "…і вони жили, змінившись, довго і щасливо.", "Життя триває, але ті, хто його прожив, назавжди змінилися.", "Грайте для реалістичних, трансформуючих кінцівок."),
]

# Generate SQL
sql_output = """-- Seed file for default deck and cards
-- This file populates the database with the default "Once Upon a Time" deck
-- Includes i18n support with translations in EN, RU, and UA

-- Insert the default deck
INSERT INTO "public"."decks" (id, name, description, is_active, created_by)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Once Upon a Time - Default Deck',
  'The classic storytelling deck with archetypal characters, settings, objects, and plot catalysts designed to create compelling narratives.',
  true,
  'system'
) ON CONFLICT (id) DO NOTHING;

"""

import json
import os
import subprocess
import sys
import tempfile
import uuid

def upload_deck_images(deck_name: str = "default") -> dict:
    """
    Call upload_images.py subprocess to upload images and return URL mappings.
    
    Args:
        deck_name: Name of the deck to process images for
        
    Returns:
        Dictionary with deck_images and card_images URL mappings
        Returns empty structure if upload fails
    """
    print(f"🖼️  Uploading images for deck: {deck_name}")
    
    # Create temporary file for JSON output
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
        temp_json_path = temp_file.name
    
    try:
        # Build command to call upload_images.py
        script_dir = os.path.dirname(os.path.abspath(__file__))
        upload_script = os.path.join(script_dir, "upload_images.py")
        
        cmd = [
            sys.executable,  # Use the same Python interpreter
            upload_script,
            "--deck", deck_name,
            "--output-json", temp_json_path,
            "--verbosity", "normal"  # Moderate verbosity for seed generation
        ]
        
        print(f"📤 Running: {' '.join(cmd)}")
        
        # Execute upload_images.py
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        if result.returncode == 0:
            print("✅ Image upload completed successfully")
            
            # Read and parse JSON output
            try:
                with open(temp_json_path, 'r', encoding='utf-8') as f:
                    image_urls = json.load(f)
                
                # Log summary of what was uploaded
                deck_images = image_urls.get('deck_images', {})
                card_images = image_urls.get('card_images', {})
                
                total_deck_images = 0
                total_card_images = 0
                
                for deck_data in deck_images.values():
                    if 'card_back_image_url' in deck_data:
                        total_deck_images += 1
                    if 'bg_image_url' in deck_data:
                        total_deck_images += 1
                    if 'category_images' in deck_data:
                        total_deck_images += len(deck_data['category_images'])
                
                for card_data in card_images.values():
                    total_card_images += len(card_data)
                
                print(f"📊 Upload summary: {total_deck_images} deck images, {total_card_images} card images")
                
                return image_urls
                
            except (json.JSONDecodeError, FileNotFoundError) as e:
                print(f"⚠️  Failed to read JSON output: {e}")
                print("📝 Continuing without image URLs")
                return {"deck_images": {}, "card_images": {}}
        
        else:
            print(f"⚠️  Image upload failed with return code: {result.returncode}")
            if result.stderr:
                print(f"📝 Error output: {result.stderr}")
            if result.stdout:
                print(f"📝 Standard output: {result.stdout}")
            print("📝 Continuing without image URLs")
            return {"deck_images": {}, "card_images": {}}
    
    except subprocess.TimeoutExpired:
        print("⚠️  Image upload timed out after 5 minutes")
        print("📝 Continuing without image URLs")
        return {"deck_images": {}, "card_images": {}}
    
    except Exception as e:
        print(f"⚠️  Unexpected error during image upload: {e}")
        print("📝 Continuing without image URLs")
        return {"deck_images": {}, "card_images": {}}
    
    finally:
        # Clean up temporary file
        try:
            if os.path.exists(temp_json_path):
                os.unlink(temp_json_path)
        except Exception:
            pass  # Ignore cleanup errors

def generate_card_inserts(cards, card_type, category, label=None, image_urls=None):
    """Generate INSERT statements for a category of cards with locale-specific image support"""
    category_label = label if label else (category.title() if category else "Endings")
    result = f"-- Insert {category_label} ({len(cards)} cards)\n"
    result += 'INSERT INTO "public"."cards" (id, deck_id, name, description, type, category, usage_examples, translations, image_url) VALUES\n'
    
    card_values = []
    deck_id = '00000000-0000-0000-0000-000000000001'
    
    # Get card images for this deck
    deck_card_images = {}
    if image_urls and 'card_images' in image_urls:
        for deck_name, cards_dict in image_urls['card_images'].items():
            deck_card_images.update(cards_dict)
    
    for card_data in cards:
        if len(card_data) == 3:
            name, description, usage_examples = card_data
            ru_name = ru_desc = ru_usage = ua_name = ua_desc = ua_usage = None
        elif len(card_data) == 9:
            name, description, usage_examples, ru_name, ru_desc, ru_usage, ua_name, ua_desc, ua_usage = card_data
        else:
            raise ValueError(f"Invalid card data length: {len(card_data)}")

        # Generate deterministic UUID based on deck_id and card name
        # This ensures the same card always gets the same ID, allowing for idempotent updates
        card_id = str(uuid.uuid5(uuid.UUID(deck_id), name))

        # Get image URLs for this card (locale-specific and generic)
        card_image_urls = deck_card_images.get(name)
        
        # Create translations with locale-specific image URLs
        translations_json = create_translation_json(
            name, description, usage_examples, 
            ru_name, ru_desc, ru_usage, 
            ua_name, ua_desc, ua_usage,
            image_urls=card_image_urls
        )
        
        cat_value = f"'{category}'" if category else "NULL"
        
        # For backward compatibility, use generic image or first available locale image for image_url field
        image_url = None
        if card_image_urls:
            if isinstance(card_image_urls, dict):
                # New structure with locale-specific images
                if 'generic_image' in card_image_urls:
                    image_url = card_image_urls['generic_image']
                elif 'locale_images' in card_image_urls and card_image_urls['locale_images']:
                    # Use first available locale image as fallback
                    first_locale = next(iter(card_image_urls['locale_images']))
                    image_url = card_image_urls['locale_images'][first_locale]
            else:
                # Old structure (direct URL string)
                image_url = card_image_urls
        
        image_url_sql = f"'{image_url}'" if image_url else "NULL"
        
        card_sql = f"""('{card_id}', '{deck_id}', '{escape_sql(name)}', '{escape_sql(description)}', '{card_type}', {cat_value}, '{escape_sql(usage_examples)}', '{translations_json}', {image_url_sql})"""
        card_values.append(card_sql)
    
    result += ',\n'.join(card_values)
    result += '\nON CONFLICT (id) DO UPDATE SET\n'
    result += '  name = EXCLUDED.name,\n'
    result += '  description = EXCLUDED.description,\n'
    result += '  type = EXCLUDED.type,\n'
    result += '  category = EXCLUDED.category,\n'
    result += '  usage_examples = EXCLUDED.usage_examples,\n'
    result += '  translations = EXCLUDED.translations,\n'
    result += '  image_url = EXCLUDED.image_url;\n\n'
    return result

def generate_deck_insert(deck_name: str = "default", image_urls: dict = None) -> str:
    """Generate INSERT statement for deck with image URLs and layout configuration"""
    deck_id = '00000000-0000-0000-0000-000000000001'
    
    # Get deck images for this deck
    deck_images = {}
    if image_urls and 'deck_images' in image_urls:
        deck_images = image_urls['deck_images'].get(deck_name, {})
    
    # Extract image URLs
    card_back_image_url = deck_images.get('card_back_image_url')
    bg_image_url = deck_images.get('bg_image_url')
    category_images = deck_images.get('category_images', {})
    layout_config = deck_images.get('layout_config', {})
    
    # Format SQL values
    card_back_sql = f"'{card_back_image_url}'" if card_back_image_url else "NULL"
    bg_image_sql = f"'{bg_image_url}'" if bg_image_url else "NULL"
    
    # Format category_images as JSONB
    category_images_sql = "NULL"
    if category_images:
        category_json = json.dumps(category_images, ensure_ascii=False, separators=(',', ':'))
        category_images_sql = f"'{escape_sql(category_json)}'"
    
    # Format layout_config as JSONB
    layout_config_sql = "NULL"
    if layout_config:
        layout_json = json.dumps(layout_config, ensure_ascii=False, separators=(',', ':'))
        layout_config_sql = f"'{escape_sql(layout_json)}'"
    
    result = f"""-- Insert deck: {deck_name}
INSERT INTO "public"."decks" (id, name, description, card_back_image_url, bg_image_url, category_images, card_layout) VALUES
('{deck_id}', '{escape_sql(deck_name)}', 'Default story deck with protagonists, antagonists, settings, objects, catalysts, traits, and endings', {card_back_sql}, {bg_image_sql}, {category_images_sql}, {layout_config_sql})
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  card_back_image_url = EXCLUDED.card_back_image_url,
  bg_image_url = EXCLUDED.bg_image_url,
  category_images = EXCLUDED.category_images,
  card_layout = EXCLUDED.card_layout;

"""
    return result

# Upload images before generating SQL
print("🚀 Starting seed generation with image upload...")
image_urls = upload_deck_images(deck_name="default")

# Generate deck insert with image URLs
sql_output += generate_deck_insert(deck_name="default", image_urls=image_urls)

# Generate all card inserts with image URLs
sql_output += generate_card_inserts(protagonists, 'story', 'protagonist', image_urls=image_urls)
sql_output += generate_card_inserts(antagonists, 'story', 'antagonist', image_urls=image_urls)
sql_output += generate_card_inserts(settings, 'story', 'setting', image_urls=image_urls)
sql_output += generate_card_inserts(objects, 'story', 'object', image_urls=image_urls)
sql_output += generate_card_inserts(catalysts, 'story', 'catalyst', image_urls=image_urls)
sql_output += generate_card_inserts(traits, 'story', 'trait', image_urls=image_urls)
sql_output += generate_card_inserts(endings, 'ending', None, image_urls=image_urls)

# Write to file
import os
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
seed_path = os.path.join(project_root, 'supabase', 'seed.sql')

with open(seed_path, 'w', encoding='utf-8') as f:
    f.write(sql_output)

print("✅ Generated seed.sql with i18n support and image URLs for 210 cards")
print(f"📁 File location: {seed_path}")
print("📝 Translations structure: EN (complete), RU and UA (placeholders with [RU]/[UA] prefix)")
print("🖼️  Image URLs: Integrated from upload_images.py (if available)")
print("🔄 Next step: Replace [RU] and [UA] placeholders with actual translations")
