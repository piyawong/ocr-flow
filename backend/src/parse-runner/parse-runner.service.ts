import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { FilesService } from '../files/files.service';
import { LabeledFilesService } from '../labeled-files/labeled-files.service';
import { FoundationInstrument } from '../files/foundation-instrument.entity';
import { CharterSection } from '../files/charter-section.entity';
import { CharterArticle } from '../files/charter-article.entity';
import { CharterSubItem } from '../files/charter-sub-item.entity';
import { CommitteeMember as CommitteeMemberEntity } from '../files/committee-member.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Group } from '../files/group.entity';

// Thai to Arabic numeral mapping
const THAI_TO_ARABIC: Record<string, string> = {
  '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4',
  '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9'
};

export interface FoundationInstrumentData {
  name: string;
  shortName: string;
  address: string;
  logoDescription: string;
  charterSections: {
    number: string;
    title: string;
    articles: {
      number: string;
      content: string;
      subItems?: { number: string; content: string }[];
    }[];
  }[];
}

export interface CommitteeMember {
  name: string | null;
  address: string | null;
  phone: string | null;
  position: string;
}

export interface CommitteeMembersData {
  committeeMembers: CommitteeMember[];
}

@Injectable()
export class ParseRunnerService {
  constructor(
    private filesService: FilesService,
    @Inject(forwardRef(() => LabeledFilesService))
    private labeledFilesService: LabeledFilesService,
    @InjectRepository(FoundationInstrument)
    private foundationInstrumentRepo: Repository<FoundationInstrument>,
    @InjectRepository(CommitteeMemberEntity)
    private committeeMemberRepo: Repository<CommitteeMemberEntity>,
    @InjectRepository(Organization)
    private organizationRepo: Repository<Organization>,
    @InjectRepository(Group)
    private groupRepo: Repository<Group>,
  ) {}

  // Convert Thai numerals to Arabic numerals
  private convertThaiToArabic(text: string): string {
    let result = text;
    for (const [thai, arabic] of Object.entries(THAI_TO_ARABIC)) {
      result = result.replace(new RegExp(thai, 'g'), arabic);
    }
    return result;
  }

  // Extract natural text from OCR result (handles JSON format)
  private extractOcrText(ocrText: string): string {
    if (!ocrText) return '';

    try {
      const parsed = JSON.parse(ocrText);
      if (parsed.natural_text) {
        return parsed.natural_text;
      }
      if (parsed.text) {
        return parsed.text;
      }
      return JSON.stringify(parsed);
    } catch {
      return ocrText;
    }
  }

  // Parse foundation instrument data from OCR text
  private parseFoundationInstrumentData(ocrTexts: Map<number, string>, pages: number[]): FoundationInstrumentData {
    // Combine all text from foundation instrument pages
    let combinedText = '';
    for (const pageNum of pages) {
      if (ocrTexts.has(pageNum)) {
        combinedText += this.extractOcrText(ocrTexts.get(pageNum)!) + '\n';
      }
    }

    // Convert all Thai numerals to Arabic numerals first
    combinedText = this.convertThaiToArabic(combinedText);

    // Remove page numbers
    combinedText = combinedText.replace(/<page_number>.*?<\/page_number>/gs, '');

    // Fix OCR errors
    for (let num = 1; num <= 12; num++) {
      combinedText = combinedText.replace(new RegExp(`ชื่อ ${num}`, 'g'), `ข้อ ${num}`);
    }
    combinedText = combinedText.replace(/หมวดที่ 72/g, 'หมวดที่ 12');
    combinedText = combinedText.replace(/บทบัดเคล็ด/g, 'บทเบ็ดเตล็ด');

    // Strip markdown formatting (**, -, bullet points) that interfere with regex
    combinedText = combinedText.replace(/\*\*/g, '');           // Remove **bold**
    combinedText = combinedText.replace(/^\s*-\s+/gm, '');      // Remove bullet points "- "
    combinedText = combinedText.replace(/^\s*\d+\.\s+/gm, '');  // Remove numbered lists "1. "

    // Initialize result structure
    const data: FoundationInstrumentData = {
      name: '',
      shortName: '',
      address: '',
      logoDescription: '',
      charterSections: [],
    };

    // Extract name
    const nameMatch = combinedText.match(/มูลนิธินี้(?:มี)?ชื่อว่า\s+(.+?)(?=\s*\*\*|\s*ชื่อย่อว่า|\n\s*ชื่อย่อว่า|\s*ย่อว่า|\s*ขอว่า|\s*เรียกเป็นภาษา|\n\s*ข้อ\s*[๒2]|$)/s);
    if (nameMatch) {
      let nameText = nameMatch[1].trim().replace(/\n/g, ' ');
      nameText = nameText.replace(/"/g, '');
      nameText = nameText.replace(/มูลนิธิ/g, '');
      data.name = nameText.trim();
    }

    // Extract short name - Method 1
    const shortMatch = combinedText.match(/(?:ชื่อย่อว่า|ย่อว่า|ขอว่า)\s+(.+?)(?=\s+(?:เรียก|เขียน|หรือ|คือ|ข้อ|ย่อว่า|ขอว่า)|\n\s*ข้อ|\n\s*ย่อว่า|\n|$)/);
    if (shortMatch && !shortMatch[1].includes('เรียก')) {
      data.shortName = shortMatch[1].trim();
    }

    // Extract short name - Method 2 (fallback)
    if (!data.shortName) {
      const section1Match = combinedText.match(/หมวดที่\s+1(.+?)(?=หมวดที่\s+\d+|$)/s);
      if (section1Match) {
        const abbrMatch = section1Match[1].match(/([ก-ฮ]{1,2}\.[ก-ฮ]{1,2}\.(?:[ก-ฮ]{1,2}\.)?(?:[ก-ฮ]{1,2}\.)?)/);
        if (abbrMatch) {
          data.shortName = abbrMatch[1].trim();
        }
      }
    }

    // Extract address
    const addrMatch = combinedText.match(/ข้อ\s+3[\.\s]+(.+?)(?=\s*หมวดที่\s+2|$)/s);
    if (addrMatch) {
      let addrFullText = addrMatch[1].trim().replace(/\n/g, ' ');
      // Remove "สำนักงานของมูลนิธิตั้งอยู่ที่" prefix - stop after "ที่" not after numbers
      let addrClean = addrFullText.replace(/.*?ตั้งอยู่ที่\s*/, '');
      addrClean = addrClean.replace(/(?:รับรอง)?สำเนาถูกต้อง.*$/i, '');
      data.address = addrClean.trim();
    }

    // Extract logo description
    const logoMatch = combinedText.match(/เครื่องหมายของมูลนิธินี้\s+คือ\s+(.+?)(?=\n\s*<figure>|\n\s*ข้อ|$)/s);
    if (logoMatch) {
      let logoDesc = logoMatch[1].trim().replace(/\n/g, ' ');
      // Remove "(ตามรูปที่ปรากฏด้านล่างนี้)" and everything after it
      logoDesc = logoDesc.replace(/\s*\(ตามรูปที่ปรากฏด้านล่างนี้\).*$/s, '');
      data.logoDescription = logoDesc.trim();
    }

    // Extract charter sections
    const sectionPattern = /หมวดที่\s+([๐-๙\d]+)\s+([^\n]+)/g;
    const sections: { match: RegExpMatchArray; start: number; end: number; num: string; title: string }[] = [];
    let match;
    while ((match = sectionPattern.exec(combinedText)) !== null) {
      sections.push({
        match,
        start: match.index,
        end: match.index + match[0].length,
        num: match[1],
        title: match[2].trim(),
      });
    }

    // Process sections
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const startPos = section.end;
      const endPos = i + 1 < sections.length ? sections[i + 1].start : combinedText.length;
      const sectionText = combinedText.substring(startPos, endPos);

      // Extract articles
      const articlePattern = /ข้อ\s+([๐-๙\d]+)[\.\s]+(.+?)(?=\n\s*ข้อ|\n\s*หมวด|$)/gs;
      const articles: FoundationInstrumentData['charterSections'][0]['articles'] = [];
      let articleMatch;

      while ((articleMatch = articlePattern.exec(sectionText)) !== null) {
        const articleNum = articleMatch[1];
        let articleFullText = articleMatch[2].trim().replace(/\n/g, ' ');

        // Extract sub-items
        const subItemPattern = new RegExp(`${articleNum}\\.(\\d+)\\s+(.+?)(?=\\s*${articleNum}\\.\\d+|$)`, 'g');
        const subItems: { number: string; content: string }[] = [];
        let subMatch;

        while ((subMatch = subItemPattern.exec(articleFullText)) !== null) {
          subItems.push({
            number: `${articleNum}.${subMatch[1]}`,
            content: subMatch[2].trim(),
          });
        }

        if (subItems.length > 0) {
          const firstSubMatch = articleFullText.match(new RegExp(`${articleNum}\\.\\d+`));
          const mainContent = firstSubMatch
            ? articleFullText.substring(0, firstSubMatch.index).trim()
            : articleFullText;

          articles.push({
            number: articleNum,
            content: mainContent,
            subItems,
          });
        } else {
          articles.push({
            number: articleNum,
            content: articleFullText,
          });
        }
      }

      if (articles.length > 0) {
        data.charterSections.push({
          number: section.num,
          title: section.title,
          articles,
        });
      }
    }

    // Sort charter sections by section number (ascending) - use numeric comparison
    data.charterSections.sort((a, b) => {
      const numA = parseInt(a.number.trim(), 10);
      const numB = parseInt(b.number.trim(), 10);
      return numA - numB;
    });

    return data;
  }

  // Parse committee members from ม.น.2 (เปลี่ยนแปลง) document
  private parseCommitteeMembersFromMN2(ocrTexts: Map<number, string>, pages: number[]): CommitteeMembersData {
    console.log(`[ParseData] Parsing committee members from ม.น.2 (เปลี่ยนแปลง)...`);

    // Parse each page separately to extract dates
    interface MN2PageData {
      pageNum: number;
      date: Date | null;
      members: CommitteeMember[];
    }

    const pagesData: MN2PageData[] = [];

    for (const pageNum of pages) {
      if (!ocrTexts.has(pageNum)) continue;

      const pageText = this.extractOcrText(ocrTexts.get(pageNum)!);
      const members: CommitteeMember[] = [];

      // Extract date from page (same logic as parseCommitteeMembersData)
      let pageDate: Date | null = null;
      const datePatterns = [
        /(?:วันที่|ณ\s*วันที่)\s*(\d+)\s*(?:เดือน)?\s*(\S+)\s*(?:พ\.ศ\.?|พศ)\s*(\d+)/i,
        /(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/,  // dd/mm/yyyy or dd/mm/yy
      ];

      for (const pattern of datePatterns) {
        const dateMatch = pageText.match(pattern);
        if (dateMatch) {
          try {
            if (pattern === datePatterns[0]) {
              // Thai month format
              const day = parseInt(dateMatch[1], 10);
              const monthText = dateMatch[2];
              let year = parseInt(dateMatch[3], 10);

              // Convert Buddhist year to Christian year
              if (year > 2400) year -= 543;

              const thaiMonths: Record<string, number> = {
                'มกราคม': 0, 'ม.ค.': 0, 'กุมภาพันธ์': 1, 'ก.พ.': 1,
                'มีนาคม': 2, 'มี.ค.': 2, 'เมษายน': 3, 'เม.ย.': 3,
                'พฤษภาคม': 4, 'พ.ค.': 4, 'มิถุนายน': 5, 'มิ.ย.': 5,
                'กรกฎาคม': 6, 'ก.ค.': 6, 'สิงหาคม': 7, 'ส.ค.': 7,
                'กันยายน': 8, 'ก.ย.': 8, 'ตุลาคม': 9, 'ต.ค.': 9,
                'พฤศจิกายน': 10, 'พ.ย.': 10, 'ธันวาคม': 11, 'ธ.ค.': 11,
              };

              const month = thaiMonths[monthText] ?? 0;
              pageDate = new Date(year, month, day);
            } else {
              // Numeric format dd/mm/yyyy
              const day = parseInt(dateMatch[1], 10);
              const month = parseInt(dateMatch[2], 10) - 1;
              let year = parseInt(dateMatch[3], 10);

              // Handle 2-digit year
              if (year < 100) year += 2500;
              // Convert Buddhist year to Christian year
              if (year > 2400) year -= 543;

              pageDate = new Date(year, month, day);
            }
            break;
          } catch (e) {
            // Failed to parse date, continue
          }
        }
      }

      // Extract table (format: cells[0]=เลข + ชื่อ, cells[1]=ตำแหน่ง)
      const tablePattern = /<table>(.*?)<\/table>/gs;
      let tableMatch;

      while ((tableMatch = tablePattern.exec(pageText)) !== null) {
        const tableContent = tableMatch[1];

        // Extract rows
        const rowPattern = /<tr>(.*?)<\/tr>/gs;
        const rows: string[] = [];
        let rowMatch;
        while ((rowMatch = rowPattern.exec(tableContent)) !== null) {
          rows.push(rowMatch[1]);
        }

        for (const row of rows) {
          // Extract cells
          const cellPattern = /<td>(.*?)<\/td>/gs;
          const cells: string[] = [];
          let cellMatch;
          while ((cellMatch = cellPattern.exec(row)) !== null) {
            cells.push(cellMatch[1]);
          }

          // Check if this row contains committee member data
          // Format: cells[0] = "1. นายธงชัย รักปทุม", cells[1] = "ประธานกรรมการ"
          if (cells.length >= 2) {
            const nameCell = cells[0]?.trim();
            const positionCell = cells[1]?.trim();

            // Check if nameCell starts with number (e.g., "1. นายธงชัย")
            const nameMatch = nameCell?.match(/^\d+\.\s*(.+)$/);
            if (nameMatch && positionCell) {
              const name = nameMatch[1].trim();
              const position = positionCell;

              // Skip if position looks like metadata (not a real position)
              if (
                !position.includes('ที่ทำการ') &&
                !position.includes('ที่อยู่') &&
                !position.includes('วัตถุประสงค์')
              ) {
                members.push({
                  name,
                  address: null,
                  phone: null,
                  position,
                });
              }
            }
          }
        }
      }

      if (members.length > 0) {
        pagesData.push({
          pageNum,
          date: pageDate,
          members,
        });
      }
    }

    console.log(`[ParseData] Found ${pagesData.length} ม.น.2 (เปลี่ยนแปลง) page(s) with committee data`);

    // Select the page with latest date (or max order if no dates)
    let selectedPage: MN2PageData | null = null;

    if (pagesData.length === 1) {
      selectedPage = pagesData[0];
    } else if (pagesData.length > 1) {
      // Prefer page with latest date
      const pagesWithDate = pagesData.filter(p => p.date !== null);

      if (pagesWithDate.length > 0) {
        selectedPage = pagesWithDate.reduce((best, current) => {
          if (!best.date || (current.date && current.date > best.date)) {
            return current;
          }
          return best;
        });
        console.log(`[ParseData] Selected ม.น.2 page by latest date: ${selectedPage.date?.toISOString().split('T')[0]}`);
      } else {
        // No dates found, use max order
        selectedPage = pagesData.reduce((best, current) => {
          return current.pageNum > best.pageNum ? current : best;
        });
        console.log(`[ParseData] Selected ม.น.2 page by max order: ${selectedPage.pageNum}`);
      }
    }

    // Return members from selected page
    const data: CommitteeMembersData = {
      committeeMembers: [],
    };

    if (selectedPage) {
      data.committeeMembers = selectedPage.members;
      console.log(`[ParseData] Total members from ม.น.2: ${data.committeeMembers.length}`);
    }

    return data;
  }

  // Parse committee members data from OCR text
  private parseCommitteeMembersData(ocrTexts: Map<number, string>, pages: number[]): CommitteeMembersData {
    // Parse each page separately to extract running numbers and dates
    interface PageData {
      pageNum: number;
      runningNumbers: number[];
      date: Date | null;
      members: CommitteeMember[];
    }

    const pagesData: PageData[] = [];

    for (const pageNum of pages) {
      if (!ocrTexts.has(pageNum)) continue;

      const pageText = this.extractOcrText(ocrTexts.get(pageNum)!);
      const runningNumbers: number[] = [];
      const members: CommitteeMember[] = [];

      // Extract date from page (Thai format: "วันที่ X เดือน Y พ.ศ. Z" or "ณ วันที่...")
      let pageDate: Date | null = null;
      const datePatterns = [
        /(?:วันที่|ณ\s*วันที่)\s*(\d+)\s*(?:เดือน)?\s*(\S+)\s*(?:พ\.ศ\.?|พศ)\s*(\d+)/i,
        /(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/,  // dd/mm/yyyy or dd/mm/yy
      ];

      for (const pattern of datePatterns) {
        const dateMatch = pageText.match(pattern);
        if (dateMatch) {
          try {
            if (pattern === datePatterns[0]) {
              // Thai month format
              const day = parseInt(dateMatch[1], 10);
              const monthText = dateMatch[2];
              let year = parseInt(dateMatch[3], 10);

              // Convert Buddhist year to Christian year
              if (year > 2400) year -= 543;

              const thaiMonths: Record<string, number> = {
                'มกราคม': 0, 'ม.ค.': 0, 'กุมภาพันธ์': 1, 'ก.พ.': 1,
                'มีนาคม': 2, 'มี.ค.': 2, 'เมษายน': 3, 'เม.ย.': 3,
                'พฤษภาคม': 4, 'พ.ค.': 4, 'มิถุนายน': 5, 'มิ.ย.': 5,
                'กรกฎาคม': 6, 'ก.ค.': 6, 'สิงหาคม': 7, 'ส.ค.': 7,
                'กันยายน': 8, 'ก.ย.': 8, 'ตุลาคม': 9, 'ต.ค.': 9,
                'พฤศจิกายน': 10, 'พ.ย.': 10, 'ธันวาคม': 11, 'ธ.ค.': 11,
              };

              const month = thaiMonths[monthText] ?? 0;
              pageDate = new Date(year, month, day);
            } else {
              // Numeric format dd/mm/yyyy
              const day = parseInt(dateMatch[1], 10);
              const month = parseInt(dateMatch[2], 10) - 1;
              let year = parseInt(dateMatch[3], 10);

              // Handle 2-digit year
              if (year < 100) year += 2500;
              // Convert Buddhist year to Christian year
              if (year > 2400) year -= 543;

              pageDate = new Date(year, month, day);
            }
            break;
          } catch (e) {
            // Failed to parse date, continue
          }
        }
      }

      // Extract tables from this page
      const tablePattern = /<table>(.*?)<\/table>/gs;
      let tableMatch;

      while ((tableMatch = tablePattern.exec(pageText)) !== null) {
        const tableContent = tableMatch[1];

        // Extract rows (skip header row)
        const rowPattern = /<tr>(.*?)<\/tr>/gs;
        const rows: string[] = [];
        let rowMatch;
        while ((rowMatch = rowPattern.exec(tableContent)) !== null) {
          rows.push(rowMatch[1]);
        }

        for (let i = 0; i < rows.length; i++) {
          if (i === 0) continue; // Skip header row

          const row = rows[i];

          // Extract cells
          const cellPattern = /<td>(.*?)<\/td>/gs;
          const cells: string[] = [];
          let cellMatch;
          while ((cellMatch = cellPattern.exec(row)) !== null) {
            cells.push(cellMatch[1]);
          }

          if (cells.length >= 4) {
            // Extract running number from cells[0]
            const runningNumText = cells[0]?.trim();
            if (runningNumText) {
              const runningNum = parseInt(runningNumText, 10);
              if (!isNaN(runningNum)) {
                runningNumbers.push(runningNum);
              }
            }

            const name = cells[1]?.trim() || null;
            const address = cells[3]?.trim() || null;

            // Try to get phone
            let phone: string | null = null;
            if (cells.length >= 8) {
              const phoneText = cells[4]?.trim();
              if (phoneText && phoneText !== '') {
                phone = phoneText;
              }
            } else if (cells.length >= 7) {
              const phoneText = cells[4]?.trim();
              if (phoneText && (phoneText.includes('-') || /^\d+$/.test(phoneText))) {
                phone = phoneText;
              }
            }

            // Try to get position
            let position = '';
            if (cells.length >= 8) {
              position = cells[6]?.trim() || '';
            } else if (cells.length >= 6) {
              position = cells[5]?.trim() || '';
            }

            members.push({
              name,
              address,
              phone,
              position,
            });
          }
        }
      }

      if (members.length > 0) {
        pagesData.push({
          pageNum,
          runningNumbers,
          date: pageDate,
          members,
        });
      }
    }

    // Group consecutive pages by running numbers
    interface PageGroup {
      pages: PageData[];
      minRunningNum: number;
      maxRunningNum: number;
      latestDate: Date | null;
      maxOrder: number;
    }

    const groups: PageGroup[] = [];
    let currentGroup: PageGroup | null = null;

    for (const pageData of pagesData) {
      const minRun = Math.min(...pageData.runningNumbers);
      const maxRun = Math.max(...pageData.runningNumbers);

      if (!currentGroup) {
        // Start new group
        currentGroup = {
          pages: [pageData],
          minRunningNum: minRun,
          maxRunningNum: maxRun,
          latestDate: pageData.date,
          maxOrder: pageData.pageNum,
        };
      } else {
        // Check if running numbers are consecutive
        const isConsecutive =
          minRun === currentGroup.maxRunningNum + 1 ||
          minRun === currentGroup.maxRunningNum ||
          minRun <= currentGroup.maxRunningNum + 2;  // Allow small gap

        if (isConsecutive) {
          // Add to current group
          currentGroup.pages.push(pageData);
          currentGroup.maxRunningNum = Math.max(currentGroup.maxRunningNum, maxRun);

          // Update latest date
          if (pageData.date) {
            if (!currentGroup.latestDate || pageData.date > currentGroup.latestDate) {
              currentGroup.latestDate = pageData.date;
            }
          }

          // Update max order
          currentGroup.maxOrder = Math.max(currentGroup.maxOrder, pageData.pageNum);
        } else {
          // Start new group
          groups.push(currentGroup);
          currentGroup = {
            pages: [pageData],
            minRunningNum: minRun,
            maxRunningNum: maxRun,
            latestDate: pageData.date,
            maxOrder: pageData.pageNum,
          };
        }
      }
    }

    // Add last group
    if (currentGroup) {
      groups.push(currentGroup);
    }

    console.log(`[ParseData] Found ${groups.length} committee member groups`);

    // Select the best group
    let selectedGroup: PageGroup | null = null;

    if (groups.length === 1) {
      selectedGroup = groups[0];
    } else if (groups.length > 1) {
      // Prefer group with latest date
      const groupsWithDate = groups.filter(g => g.latestDate !== null);

      if (groupsWithDate.length > 0) {
        selectedGroup = groupsWithDate.reduce((best, current) => {
          if (!best.latestDate || (current.latestDate && current.latestDate > best.latestDate)) {
            return current;
          }
          return best;
        });
        console.log(`[ParseData] Selected group by latest date: ${selectedGroup.latestDate?.toISOString().split('T')[0]}`);
      } else {
        // No dates found, use max order
        selectedGroup = groups.reduce((best, current) => {
          return current.maxOrder > best.maxOrder ? current : best;
        });
        console.log(`[ParseData] Selected group by max order: ${selectedGroup.maxOrder}`);
      }
    }

    // Collect members from selected group
    const data: CommitteeMembersData = {
      committeeMembers: [],
    };

    if (selectedGroup) {
      for (const pageData of selectedGroup.pages) {
        data.committeeMembers.push(...pageData.members);
      }
      console.log(`[ParseData] Total members: ${data.committeeMembers.length} from ${selectedGroup.pages.length} pages`);
    }

    return data;
  }


  // Save parsed data to database tables
  private async saveParsedDataToDatabase(
    groupId: number,
    foundationInstrumentData: FoundationInstrumentData | null,
    committeeMembersData: CommitteeMembersData | null,
  ): Promise<void> {
    // Save foundation instrument
    if (foundationInstrumentData) {
      // Check if already exists
      const existing = await this.foundationInstrumentRepo.findOne({
        where: { groupId },
      });

      if (existing) {
        // Delete existing data
        await this.foundationInstrumentRepo.remove(existing);
      }

      // Create new foundation instrument
      const foundationInstrument = this.foundationInstrumentRepo.create({
        groupId,
        name: foundationInstrumentData.name,
        shortName: foundationInstrumentData.shortName,
        address: foundationInstrumentData.address,
        logoDescription: foundationInstrumentData.logoDescription,
      });

      await this.foundationInstrumentRepo.save(foundationInstrument);

      // Save charter sections, articles, and sub-items
      for (let sectionIndex = 0; sectionIndex < foundationInstrumentData.charterSections.length; sectionIndex++) {
        const sectionData = foundationInstrumentData.charterSections[sectionIndex];

        const section = await this.foundationInstrumentRepo.manager.save(CharterSection, {
          foundationInstrumentId: foundationInstrument.id,
          number: sectionData.number,
          title: sectionData.title,
          orderIndex: sectionIndex,
        });

        // Save articles
        for (let articleIndex = 0; articleIndex < sectionData.articles.length; articleIndex++) {
          const articleData = sectionData.articles[articleIndex];

          const article = await this.foundationInstrumentRepo.manager.save(CharterArticle, {
            charterSectionId: section.id,
            number: articleData.number,
            content: articleData.content,
            orderIndex: articleIndex,
          });

          // Save sub-items if any
          if (articleData.subItems && articleData.subItems.length > 0) {
            for (let subIndex = 0; subIndex < articleData.subItems.length; subIndex++) {
              const subItemData = articleData.subItems[subIndex];

              await this.foundationInstrumentRepo.manager.save(CharterSubItem, {
                charterArticleId: article.id,
                number: subItemData.number,
                content: subItemData.content,
                orderIndex: subIndex,
              });
            }
          }
        }
      }
    }

    // Save committee members
    if (committeeMembersData && committeeMembersData.committeeMembers.length > 0) {
      // Delete existing committee members for this group
      await this.committeeMemberRepo.delete({ groupId });

      // Save new committee members
      for (let i = 0; i < committeeMembersData.committeeMembers.length; i++) {
        const memberData = committeeMembersData.committeeMembers[i];

        await this.committeeMemberRepo.save({
          groupId,
          name: memberData.name,
          address: memberData.address,
          phone: memberData.phone,
          position: memberData.position,
          orderIndex: i,
        });
      }
    }

    // Match district office and update group
    if (foundationInstrumentData && foundationInstrumentData.name) {
      const foundationName = foundationInstrumentData.name.trim();

      if (foundationName) {
        console.log(`[ParseData] Searching organization for foundation: "${foundationName}"`);

        // Try exact match first (case-insensitive)
        let organization = await this.organizationRepo
          .createQueryBuilder('organization')
          .where('LOWER(organization.name) = LOWER(:foundationName)', { foundationName })
          .andWhere('organization.isActive = :isActive', { isActive: true })
          .getOne();

        // If no exact match, try partial match
        if (!organization) {
          organization = await this.organizationRepo
            .createQueryBuilder('organization')
            .where('LOWER(organization.name) LIKE LOWER(:foundationName)', {
              foundationName: `%${foundationName}%`,
            })
            .andWhere('organization.isActive = :isActive', { isActive: true })
            .getOne();
        }

        if (organization) {
          console.log(`[ParseData] ✓ Found organization: ${organization.districtOfficeName} (เลข กท. ${organization.registrationNumber})`);

          // Update group with organization info
          await this.groupRepo.update(groupId, {
            districtOffice: organization.districtOfficeName,
            registrationNumber: organization.registrationNumber,
          });
        } else {
          console.log(`[ParseData] ✗ No organization match found for: "${foundationName}"`);
        }
      }
    }

    // Update group parseData status
    await this.filesService.updateGroupParseData(groupId, null);

    // ✅ Send SSE event: GROUP_PARSED
    this.filesService.emitEvent({
      type: 'GROUP_PARSED',
      groupId,
      timestamp: new Date().toISOString(),
    });
  }

  // Parse a single group by ID (force=true to re-parse even if already parsed)
  async parseGroup(groupId: number, force = false): Promise<{
    success: boolean;
    message: string;
    data?: {
      foundationInstrument?: FoundationInstrumentData | null;
      committeeMembers?: CommitteeMembersData | null;
    };
  }> {
    console.log(`[ParseData] ${force ? 'Re-parsing' : 'Parsing'} Group ${groupId}...`);

    try {
      // Check if group exists
      const group = await this.filesService.findGroupById(groupId);
      if (!group) {
        return {
          success: false,
          message: `Group ${groupId} not found`,
        };
      }

      // Check if already parsed (skip if force=true)
      if (group.isParseData && !force) {
        return {
          success: false,
          message: `Group ${groupId} has already been parsed. Use force=true to re-parse.`,
        };
      }

      if (!group.isAutoLabeled) {
        return {
          success: false,
          message: `Group ${groupId} has not been auto-labeled yet`,
        };
      }

      // Check if group is 100% matched
      const is100Matched = await this.labeledFilesService.isGroup100Matched(groupId);
      if (!is100Matched) {
        return {
          success: false,
          message: `Group ${groupId} must be 100% matched before parsing`,
        };
      }

      // Check if group has been user reviewed
      const isUserReviewed = await this.labeledFilesService.isGroupUserReviewed(groupId);
      if (!isUserReviewed) {
        return {
          success: false,
          message: `Group ${groupId} must be user reviewed before parsing`,
        };
      }

      // Get pages with labels (merge files + documents)
      const files = await this.labeledFilesService.getGroupPagesWithLabels(groupId);
      if (files.length === 0) {
        return {
          success: false,
          message: `Group ${groupId} has no files`,
        };
      }

      console.log(`[ParseData] Group ${groupId}: Found ${files.length} files`);

      // Create OCR texts map
      const ocrTexts = new Map<number, string>();
      for (const file of files) {
        ocrTexts.set(file.orderInGroup, file.ocrText || '');
      }

      // Find documents by template
      let foundationInstrument: FoundationInstrumentData | null = null;
      let committeeMembers: CommitteeMembersData | null = null;

      // Process each document type
      const foundationDocs = files.filter(f =>
        f.templateName?.includes('ตราสาร') && !f.templateName?.includes('แก้ไข')
      );
      const committeeDocs = files.filter(f =>
        f.templateName?.includes('บัญชีรายชื่อกรรมการ')
      );

      // Parse foundation instrument
      if (foundationDocs.length > 0) {
        const pages = foundationDocs.map(f => f.orderInGroup).sort((a, b) => a - b);
        console.log(`[ParseData] Parsing foundation instrument (${pages.length} pages)...`);
        foundationInstrument = this.parseFoundationInstrumentData(ocrTexts, pages);
        console.log(`[ParseData] Name: ${foundationInstrument.name || 'N/A'}`);
        console.log(`[ParseData] Short Name: ${foundationInstrument.shortName || 'N/A'}`);
        console.log(`[ParseData] Sections: ${foundationInstrument.charterSections.length}`);
      }

      // Check for ม.น.2 (เปลี่ยนแปลง) first - this takes priority over regular committee list
      const mn2ChangeDocs = files.filter(f =>
        f.templateName?.includes('หนังสือให้อำนาจและรายละเอียดการเปลี่ยนแปลง') &&
        f.templateName?.includes('(ม.น.2)') &&
        f.templateName?.includes('(เปลี่ยนแปลง)')
      );

      if (mn2ChangeDocs.length > 0) {
        const pages = mn2ChangeDocs.map(f => f.orderInGroup).sort((a, b) => a - b);
        console.log(`[ParseData] Found ม.น.2 (เปลี่ยนแปลง) document - using this for committee members (${pages.length} pages)...`);
        committeeMembers = this.parseCommitteeMembersFromMN2(ocrTexts, pages);
        console.log(`[ParseData] Members found from ม.น.2: ${committeeMembers.committeeMembers.length}`);
      } else if (committeeDocs.length > 0) {
        // Fallback to regular committee list if no ม.น.2 (เปลี่ยนแปลง)
        const pages = committeeDocs.map(f => f.orderInGroup).sort((a, b) => a - b);
        console.log(`[ParseData] Parsing committee members from regular list (${pages.length} pages)...`);
        committeeMembers = this.parseCommitteeMembersData(ocrTexts, pages);
        console.log(`[ParseData] Members found: ${committeeMembers.committeeMembers.length}`);
      }

      // Save parsed data to database tables
      await this.saveParsedDataToDatabase(groupId, foundationInstrument, committeeMembers);

      console.log(`[ParseData] Group ${groupId}: Parse data complete!`);

      return {
        success: true,
        message: `Group ${groupId} parsed successfully`,
        data: {
          foundationInstrument,
          committeeMembers,
        },
      };

    } catch (error) {
      console.error(`[ParseData] Group ${groupId}: Error - ${error.message}`);
      return {
        success: false,
        message: `Failed to parse group ${groupId}: ${error.message}`,
      };
    }
  }
}
