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