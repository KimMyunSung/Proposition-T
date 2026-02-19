require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client } = require('@notionhq/client');
const path = require('path');
const { NotionToMarkdown } = require('notion-to-md');
const marked = require('marked'); 
// notion 객체는 이미 있으실 테니, 그 아래에 n2m만 추가 선언해 줍니다.
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });
const app = express();
app.use(cors());
app.set('view engine', 'ejs');
// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public'))); 

// 노션 클라이언트 초기화
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

        // 상세 페이지 라우터 (반드시 app.listen 보다 위에 위치해야 합니다)
app.get('/post/:id', async (req, res) => {
    const pageId = req.params.id;

    try {
        const page = await notion.pages.retrieve({ page_id: pageId });
        
// server.js 상세 페이지 라우터 내부
// 기존의 const title = ... 부분을 아래 코드로 덮어쓰기
const title = page.properties['이름']?.title[0]?.plain_text || 
              page.properties['Name']?.title[0]?.plain_text || 
              page.properties['제목']?.title[0]?.plain_text || '제목 없음';

const date = page.properties['Date']?.date?.start || 
             page.properties['날짜']?.date?.start || 'N/A';

const sender = page.properties['Sender']?.rich_text[0]?.plain_text || 
               page.properties['발신']?.rich_text[0]?.plain_text || 'T';

const receiver = page.properties['Receiver']?.rich_text[0]?.plain_text || 
                 page.properties['수신']?.rich_text[0]?.plain_text || 'All Agents';

        const mdblocks = await n2m.pageToMarkdown(pageId);
        const mdString = n2m.toMarkdownString(mdblocks);
        
        const rawMarkdown = mdString.parent || mdString; 
        const htmlContent = marked.parse(rawMarkdown);

        const postData = {
            id: pageId,
            title: title,
            date: date,
            sender: sender,
            receiver: receiver,
            content: htmlContent 
        };

        // views 폴더의 post.ejs 파일에 postData를 얹어서 화면에 보냄
        res.render('post', { post: postData });

    } catch (error) {
        console.error('상세 페이지 로드 오류:', error);
        res.status(500).send("에러가 발생했습니다.");
    }
});

// 서버 포트 설정 및 실행 (반드시 파일의 가장 마지막에 위치해야 합니다)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proposition T Server is running on port ${PORT}`);
});