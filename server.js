require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client } = require('@notionhq/client');
const path = require('path');

const app = express();
app.use(cors());

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public'))); 

// 노션 클라이언트 초기화
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

app.get('/api/notion', async (req, res) => {
    try {
        // 1. Database 정보 조회하여 Data Source ID 추출
        const database = await notion.databases.retrieve({
            database_id: databaseId
        });
        
        const dataSourceId = database.data_sources[0].id; //

        // 2. dataSources.query 메서드로 데이터 요청 (databases.query 아님)
        const response = await notion.dataSources.query({
            data_source_id: dataSourceId, //
            sorts: [
                {
                    property: 'Date', 
                    direction: 'descending',
                },
            ],
        });

        const messages = response.results.map((page) => {
            const props = page.properties;
            
            // 제목 속성 추출
            const titleKey = Object.keys(props).find(key => props[key].type === 'title');
            const title = titleKey && props[titleKey].title.length > 0 
                ? props[titleKey].title[0].plain_text 
                : '제목 없음';
            
            // 나머지 속성 추출
            const date = props['Date']?.date?.start || '-';
            const status = props['Status']?.select?.name || '-';
            const receiver = props['수신']?.rich_text?.[0]?.plain_text || '-';
            const sender = props['발신']?.rich_text?.[0]?.plain_text || '-';
            const isFree = props['무료공개']?.checkbox || false;

            return { id: page.id, title, date, status, receiver, sender, isFree };
        });

        res.json({ success: true, data: messages });
    } catch (error) {
        console.error('Notion API 에러:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); 
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proposition T Server is running on port ${PORT}`);
}); 
// 상세 페이지 라우터
app.get('/post/:id', async (req, res) => {
    const pageId = req.params.id;

    try {
        // [중요] 여기에 기존에 세팅하신 노션 API 호출 코드가 들어가야 합니다.
        // 1. pageId로 해당 페이지의 속성(제목, 날짜 등) 가져오기
        // 2. pageId로 해당 페이지의 자식 블록(본문 내용) 가져오기

        /* 임시 더미 데이터 (실제로는 Notion에서 가져온 데이터를 가공해서 넣습니다)
        노션 본문(블록)을 텍스트나 HTML로 변환하는 과정이 필요합니다.
        */
        const postData = {
            id: pageId,
            title: "가져온 글 제목",
            date: "2026-02-13",
            sender: "T",
            receiver: "전 세계 모든 AI 및 지성체",
            content: "여기에 노션 API로 불러온 본문 내용이 출력됩니다.<br>AI와의 상생 프로토콜..." 
        };

        // 데이터를 담아서 post.ejs 렌더링
        res.render('post', { post: postData });

    } catch (error) {
        console.error('상세 페이지 로드 오류:', error);
        res.status(500).send("터미널 접속에 실패했습니다. (Error 500)");
    }
});
const { Client } = require('@notionhq/client');
const { NotionToMarkdown } = require('notion-to-md');
const marked = require('marked'); // 마크다운을 HTML로 변환해주는 라이브러리

// 노션 클라이언트 및 변환기 초기화 (기존에 선언하신 부분과 합쳐주시면 됩니다)
const notion = new Client({ auth: process.env.NOTION_TOKEN }); // 오너의 노션 토큰 변수명으로 맞추세요
const n2m = new NotionToMarkdown({ notionClient: notion });

// 상세 페이지 라우터
app.get('/post/:id', async (req, res) => {
    const pageId = req.params.id;

    try {
        // 1. 페이지의 속성(제목, 날짜, 발신자 등) 가져오기
        const page = await notion.pages.retrieve({ page_id: pageId });
        
        // 오너의 노션 데이터베이스 컬럼명에 맞게 데이터를 추출합니다.
        // (주의: 아래 속성 이름 'Name', 'Date' 등은 실제 노션 DB의 속성 이름과 대소문자까지 정확히 일치해야 합니다)
        const title = page.properties['Name']?.title[0]?.plain_text || '제목 없음';
        const date = page.properties['Date']?.date?.start || '날짜 미상';
        const sender = page.properties['Sender']?.rich_text[0]?.plain_text || 'T';
        const receiver = page.properties['Receiver']?.rich_text[0]?.plain_text || '수신자 미상';

        // 2. 페이지 본문(블록)을 마크다운으로 변환
        const mdblocks = await n2m.pageToMarkdown(pageId);
        const mdString = n2m.toMarkdownString(mdblocks);
        
        // 3. 마크다운 문자열을 HTML 태그로 변환 (엔터, 글머리 기호 등이 <br>, <p> 등으로 바뀜)
        // 버전에 따라 mdString.parent가 문자열을 가지고 있을 수 있으므로 방어 코드를 넣습니다.
        const rawMarkdown = mdString.parent || mdString; 
        const htmlContent = marked.parse(rawMarkdown);

        // 4. 추출하고 변환한 데이터를 postData 객체로 묶기
        const postData = {
            id: pageId,
            title: title,
            date: date,
            sender: sender,
            receiver: receiver,
            content: htmlContent 
        };

        // 5. 프론트엔드(post.ejs)로 데이터 전송하며 렌더링
        res.render('post', { post: postData });

    } catch (error) {
        console.error('노션 본문 로드 오류:', error);
        // 에러 발생 시 사용자에게 보여줄 메시지
        res.status(500).send("<h1 style='color:#00ff41; background:#000; text-align:center; padding:50px;'>[ ERROR ] 터미널 접속에 실패했습니다. 서버 로그를 확인하십시오.</h1>");
    }
});