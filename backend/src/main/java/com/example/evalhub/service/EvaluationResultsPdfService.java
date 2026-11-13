package com.example.evalhub.service;

import com.example.evalhub.dto.*;
import com.example.evalhub.entity.SubmissionStatus;
import com.example.evalhub.entity.TeamStatus;
import com.example.evalhub.repository.ProgramRepository;
import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

@Service
public class EvaluationResultsPdfService {
    private static final Color BLUE = new Color(37, 99, 235);
    private static final Color BORDER = new Color(221, 226, 233);
    private final ProgramRepository programs;
    private final EvaluationService evaluations;
    private final byte[] fontBytes;

    public EvaluationResultsPdfService(ProgramRepository programs, EvaluationService evaluations) throws IOException {
        this.programs = programs;
        this.evaluations = evaluations;
        this.fontBytes = new ClassPathResource("fonts/NanumGothic-Regular.ttf").getContentAsByteArray();
    }

    public record PdfFile(String filename, byte[] bytes) {}

    @Transactional(readOnly = true)
    public PdfFile export(Long programId, boolean onlyPassed) {
        return export(programId, onlyPassed, EvaluationResultScoring.Method.ALL);
    }

    @Transactional(readOnly = true)
    public PdfFile export(Long programId, boolean onlyPassed, EvaluationResultScoring.Method method) {
        var program = programs.findById(programId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Program not found."));
        String title = onlyPassed ? "최종 합격 결과" : "팀별 상세 평가 결과";
        var ranked = EvaluationResultScoring.rank(evaluations.getEvaluationResults(programId), method).stream()
                .filter(row -> !onlyPassed || row.team().teamStatus() == TeamStatus.PASSED).toList();
        try (var output = new ByteArrayOutputStream();
             var document = new Document(PageSize.A4, 36, 36, 40, 40)) {
            BaseFont base = BaseFont.createFont("NanumGothic-Regular.ttf", BaseFont.IDENTITY_H,
                    BaseFont.EMBEDDED, false, fontBytes, null);
            Font normal = new Font(base, 10);
            Font bold = new Font(base, 11, Font.BOLD);
            PdfWriter writer = PdfWriter.getInstance(document, output);
            writer.setPageEvent(new PdfPageEventHelper() {
                @Override public void onEndPage(PdfWriter current, Document doc) {
                    ColumnText.showTextAligned(current.getDirectContent(), Element.ALIGN_CENTER,
                            new Phrase("- " + current.getPageNumber() + " -", new Font(base, 9)),
                            PageSize.A4.getWidth() / 2, 22, 0);
                }
            });
            document.addTitle(program.getTitle() + " · " + title);
            document.addCreator("EvalHub");
            document.open();
            Paragraph heading = new Paragraph(program.getTitle(), new Font(base, 19, Font.BOLD, BLUE));
            heading.setSpacingAfter(8);
            document.add(heading);
            Paragraph subtitle = new Paragraph(title + " · " + method.label + " · 생성일 " + LocalDate.now(ZoneId.of("Asia/Seoul"))
                    + " · 총 " + ranked.size() + "팀", normal);
            subtitle.setSpacingAfter(20);
            document.add(subtitle);
            if (ranked.isEmpty()) document.add(new Paragraph("내보낼 결과가 없습니다.", normal));
            for (int i = 0; i < ranked.size(); i++) {
                var row = ranked.get(i);
                TeamEvaluationResult team = row.team();
                PdfPTable summary = table(1);
                summary.setKeepTogether(true);
                summary.setSpacingBefore(12);
                summary.addCell(cell((row.rank() == null ? "—" : row.rank()) + ". " + team.teamName() + "  [" + status(team.teamStatus()) + "]", bold, true));
                summary.addCell(cell("심사위원 평균 " + score(row.average()) + "  +  가산점 "
                        + score(row.bonus()) + "  |  최종 점수 " + score(row.total()), normal, false));
                if (row.unavailableReason() != null) summary.addCell(cell("산출 불가: " + row.unavailableReason(), normal, false));
                document.add(summary);
                if (team.bonusScores() != null && !team.bonusScores().isEmpty()) {
                    PdfPTable bonus = table(3);
                    header(bonus, bold, "가산점 항목", "부여 점수", "최대 점수");
                    for (BonusScoreResponse item : team.bonusScores()) {
                        bonus.addCell(cell(item.name(), normal, false));
                        bonus.addCell(cell(score(item.score()), normal, false));
                        bonus.addCell(cell(item.maxScore() == null ? "상한 없음" : score(item.maxScore()), normal, false));
                    }
                    document.add(bonus);
                }
                if (!onlyPassed) {
                    PdfPTable detail = table(3);
                    detail.setWidths(new float[]{24, 12, 64});
                    header(detail, bold, "심사위원", "점수", "총평");
                    List<EvaluatorSubmissionSummary> submitted = submitted(team);
                    if (submitted.isEmpty()) {
                        PdfPCell empty = cell("제출된 평가가 없습니다.", normal, false);
                        empty.setColspan(3);
                        detail.addCell(empty);
                    }
                    for (EvaluatorSubmissionSummary evaluation : submitted) {
                        String name = evaluation.evaluatorName();
                        if (name == null || name.isBlank()) name = evaluation.evaluatorEmail();
                        if (name == null || name.isBlank()) name = "심사위원 " + evaluation.evaluatorId();
                        detail.addCell(cell(name, normal, false));
                        detail.addCell(cell(score(evaluation.submission().totalScore()) + (row.excludedIndices().contains(team.evaluations().indexOf(evaluation)) ? " (제외)" : ""), normal, false));
                        detail.addCell(cell(evaluation.submission().oneLineComment(), normal, false));
                    }
                    document.add(detail);
                }
            }
            document.close();
            String filename = (program.getTitle() == null ? "평가결과" : program.getTitle())
                    .replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").strip();
            // 파일 시스템의 단일 파일명 길이 제한을 넘지 않게 한다.
            filename = filename.codePoints().limit(60).collect(StringBuilder::new,
                    StringBuilder::appendCodePoint, StringBuilder::append).toString();
            return new PdfFile(filename + "_" + method.label + (onlyPassed ? "_최종합격.pdf" : "_상세평가.pdf"), output.toByteArray());
        } catch (IOException | DocumentException exception) {
            throw new IllegalStateException("평가 결과 PDF를 생성하지 못했습니다.", exception);
        }
    }

    private static List<EvaluatorSubmissionSummary> submitted(TeamEvaluationResult team) {
        return team.evaluations().stream().filter(e -> e.submission() != null
                && e.submission().status() == SubmissionStatus.SUBMITTED).toList();
    }

    private static PdfPTable table(int columns) {
        PdfPTable table = new PdfPTable(columns);
        table.setWidthPercentage(100);
        table.setSplitLate(false); // 한 페이지보다 긴 심사평도 누락 없이 이어서 출력한다.
        return table;
    }

    private static PdfPCell cell(String text, Font font, boolean heading) {
        PdfPCell cell = new PdfPCell(new Phrase(text == null || text.isBlank() ? "—" : text, font));
        cell.setPadding(8);
        cell.setBorderColor(BORDER);
        cell.setLeading(0, 1.5f);
        if (heading) cell.setBackgroundColor(new Color(245, 247, 250));
        return cell;
    }

    private static void header(PdfPTable table, Font font, String... labels) {
        for (String label : labels) table.addCell(cell(label, font, true));
        table.setHeaderRows(1);
    }

    private static String score(BigDecimal value) {
        return value == null ? "—" : value.setScale(1, RoundingMode.HALF_UP).toPlainString();
    }

    private static String status(TeamStatus value) {
        return switch (value) { case PASSED -> "합격"; case FAILED -> "불합격"; case PENDING -> "미정"; };
    }
}
