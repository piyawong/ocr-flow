import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReplaySubject } from 'rxjs';
import { FilesService } from '../files/files.service';
import { LabeledFilesService } from '../labeled-files/labeled-files.service';
import { FoundationInstrument } from '../files/foundation-instrument.entity';
import { CharterSection } from '../files/charter-section.entity';
import { CharterArticle } from '../files/charter-article.entity';
import { CharterSubItem } from '../files/charter-sub-item.entity';
import { CommitteeMember as CommitteeMemberEntity } from '../files/committee-member.entity';

export interface LogMessage {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

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
  private isRunning = false;
  private logSubject = new ReplaySubject<LogMessage>(100);
  private logHistory: LogMessage[] = [];
  private readonly MAX_LOGS = 500;

  constructor(
    private filesService: FilesService,
    @Inject(forwardRef(() => LabeledFilesService))
    private labeledFilesService: LabeledFilesService,
    @InjectRepository(FoundationInstrument)
    private foundationInstrumentRepo: Repository<FoundationInstrument>,
    @InjectRepository(CommitteeMemberEntity)
    private committeeMemberRepo: Repository<CommitteeMemberEntity>,
  ) {}

  getLogObservable() {
    return this.logSubject.asObservable();
  }

  getLogHistory(): LogMessage[] {
    return this.logHistory;
  }

  clearLogs() {
    this.logHistory = [];
  }

  isTaskRunning(): boolean {
    return this.isRunning;
  }

  private log(message: string, type: LogMessage['type'] = 'info') {
    const logMessage: LogMessage = {
      timestamp: new Date().toISOString(),
      message,
      type,
    };
    this.logSubject.next(logMessage);
    this.logHistory.push(logMessage);

    // Keep only last MAX_LOGS entries
    if (this.logHistory.length > this.MAX_LOGS) {
      this.logHistory = this.logHistory.slice(-this.MAX_LOGS);
    }
  }

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

    return data;
  }

  // Parse committee members data from OCR text
  private parseCommitteeMembersData(ocrTexts: Map<number, string>, pages: number[]): CommitteeMembersData {
    // Combine all text from committee documents
    let combinedText = '';
    for (const pageNum of pages) {
      if (ocrTexts.has(pageNum)) {
        combinedText += this.extractOcrText(ocrTexts.get(pageNum)!) + '\n';
      }
    }

    // Initialize result structure
    const data: CommitteeMembersData = {
      committeeMembers: [],
    };

    // Extract ALL tables from <table> tags
    const tablePattern = /<table>(.*?)<\/table>/gs;
    let tableMatch;

    while ((tableMatch = tablePattern.exec(combinedText)) !== null) {
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

          data.committeeMembers.push({
            name,
            address,
            phone,
            position,
          });
        }
      }
    }

    return data;
  }

  async startTask(): Promise<void> {
    if (this.isRunning) {
      this.log('Parse task is already running', 'warning');
      return;
    }

    this.isRunning = true;
    this.log('=== ∞ Infinite Parse Data Worker Loop Started ===', 'info');

    try {
      // Infinite loop - ทำงานจนกว่าจะถูก stop
      while (this.isRunning) {
        // Get groups that are ready to parse data (isAutoLabeled = true AND isParseData = false)
        const groupsToProcess = await this.filesService.getGroupsReadyToParseData();

        // Filter for 100% matched and user reviewed groups only
        const fullyMatchedGroups: number[] = [];
        for (const groupId of groupsToProcess) {
          const is100Matched = await this.labeledFilesService.isGroup100Matched(groupId);
          const isUserReviewed = await this.labeledFilesService.isGroupUserReviewed(groupId);
          if (is100Matched && isUserReviewed) {
            fullyMatchedGroups.push(groupId);
          }
        }

        if (fullyMatchedGroups.length === 0) {
          this.log('⏳ No groups ready to parse data. Waiting for new groups (must be 100% matched AND user reviewed)...', 'info');
          await this.sleep(5000); // รอ 5 วินาที
          continue;
        }

        this.log(`📦 Found ${fullyMatchedGroups.length} group(s) ready to parse (100% matched + user reviewed): ${fullyMatchedGroups.join(', ')}`, 'info');

        // Process each group
        for (const groupId of fullyMatchedGroups) {
          if (!this.isRunning) break;

          await this.processGroup(groupId);
        }

        // รอสักครู่ก่อน loop รอบถัดไป
        if (this.isRunning) {
          await this.sleep(2000);
        }
      }

      this.log('=== ∞ Infinite Parse Data Worker Loop Stopped ===', 'warning');
    } catch (error) {
      this.log(`Parse worker loop error: ${error.message}`, 'error');
      this.isRunning = false;
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async processGroup(groupId: number): Promise<void> {
    this.log(`--- Processing Group ${groupId} ---`);

    try {
      // ✅ NEW: Get pages with labels (merge files + documents)
      const files = await this.labeledFilesService.getGroupPagesWithLabels(groupId);
      if (files.length === 0) {
        this.log(`Group ${groupId}: No files found`, 'warning');
        return;
      }

      this.log(`Group ${groupId}: Found ${files.length} files`);

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
        this.log(`  Parsing foundation instrument (${pages.length} pages)...`);
        foundationInstrument = this.parseFoundationInstrumentData(ocrTexts, pages);
        this.log(`    Name: ${foundationInstrument.name || 'N/A'}`, 'success');
        this.log(`    Short Name: ${foundationInstrument.shortName || 'N/A'}`, 'success');
        this.log(`    Sections: ${foundationInstrument.charterSections.length}`, 'success');
      }

      // Parse committee members
      if (committeeDocs.length > 0) {
        const pages = committeeDocs.map(f => f.orderInGroup).sort((a, b) => a - b);
        this.log(`  Parsing committee members (${pages.length} pages)...`);
        committeeMembers = this.parseCommitteeMembersData(ocrTexts, pages);
        this.log(`    Members found: ${committeeMembers.committeeMembers.length}`, 'success');
      }

      // Save parsed data to database tables
      await this.saveParsedDataToDatabase(groupId, foundationInstrument, committeeMembers);

      this.log(`Group ${groupId}: Parse data complete!`, 'success');

      // Emit GROUP_PARSED event
      this.log(`GROUP_PARSED:${groupId}`, 'info');

    } catch (error) {
      this.log(`Group ${groupId}: Error - ${error.message}`, 'error');
    }
  }

  stopTask(): void {
    if (this.isRunning) {
      this.isRunning = false;
      this.log('Parse task stopped by user', 'warning');
    }
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

    // Update group parseData status
    await this.filesService.updateGroupParseData(groupId, null);
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
    this.log(`🔍 ${force ? 'Re-parsing' : 'Parsing'} Group ${groupId}...`, 'info');

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

      // ✅ NEW: Get pages with labels (merge files + documents)
      const files = await this.labeledFilesService.getGroupPagesWithLabels(groupId);
      if (files.length === 0) {
        return {
          success: false,
          message: `Group ${groupId} has no files`,
        };
      }

      this.log(`Group ${groupId}: Found ${files.length} files`);

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
        this.log(`  Parsing foundation instrument (${pages.length} pages)...`);
        foundationInstrument = this.parseFoundationInstrumentData(ocrTexts, pages);
        this.log(`    Name: ${foundationInstrument.name || 'N/A'}`, 'success');
        this.log(`    Short Name: ${foundationInstrument.shortName || 'N/A'}`, 'success');
        this.log(`    Sections: ${foundationInstrument.charterSections.length}`, 'success');
      }

      // Parse committee members
      if (committeeDocs.length > 0) {
        const pages = committeeDocs.map(f => f.orderInGroup).sort((a, b) => a - b);
        this.log(`  Parsing committee members (${pages.length} pages)...`);
        committeeMembers = this.parseCommitteeMembersData(ocrTexts, pages);
        this.log(`    Members found: ${committeeMembers.committeeMembers.length}`, 'success');
      }

      // Save parsed data to database tables
      await this.saveParsedDataToDatabase(groupId, foundationInstrument, committeeMembers);

      this.log(`✅ Group ${groupId}: Parse data complete!`, 'success');

      // Emit GROUP_PARSED event
      this.log(`GROUP_PARSED:${groupId}`, 'info');

      return {
        success: true,
        message: `Group ${groupId} parsed successfully`,
        data: {
          foundationInstrument,
          committeeMembers,
        },
      };

    } catch (error) {
      this.log(`❌ Group ${groupId}: Error - ${error.message}`, 'error');
      return {
        success: false,
        message: `Failed to parse group ${groupId}: ${error.message}`,
      };
    }
  }
}
