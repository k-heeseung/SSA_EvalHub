package com.example.evalhub;

import com.example.evalhub.dto.*;
import com.example.evalhub.entity.*;
import com.example.evalhub.repository.ProgramRepository;
import com.example.evalhub.service.EvaluationResultsPdfService;
import com.example.evalhub.service.EvaluationService;
import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class EvaluationResultsPdfServiceTest {
    private ProgramRepository programs;
    private EvaluationService evaluations;
    private EvaluationResultsPdfService service;

    @BeforeEach void setup() throws Exception {
        programs = mock(ProgramRepository.class);
        evaluations = mock(EvaluationService.class);
        service = new EvaluationResultsPdfService(programs, evaluations);
        Program program = mock(Program.class);
        when(program.getTitle()).thenReturn("글로벌챌린지");
        when(programs.findById(1L)).thenReturn(Optional.of(program));
    }

    private EvaluatorSubmissionSummary evaluation(SubmissionStatus status, String score, String comment) {
        return new EvaluatorSubmissionSummary(1L, "judge@example.com", "김심사",
                new EvaluationSubmissionResponse(1L, status, new BigDecimal(score), comment, null, List.of()));
    }

    private TeamEvaluationResult team(String name, TeamStatus status, String comment) {
        return new TeamEvaluationResult(1L, name, status, new BigDecimal("5"), List.of(
                evaluation(SubmissionStatus.SUBMITTED, "80", comment),
                evaluation(SubmissionStatus.SUBMITTED, "90", "두 번째 총평"),
                evaluation(SubmissionStatus.DRAFT, "1", "임시저장비공개내용")), List.of(
                new BonusScoreResponse(1L, "교육 수료", new BigDecimal("10"), new BigDecimal("5")),
                new BonusScoreResponse(2L, "특허", null, null)));
    }

    private String text(byte[] bytes) throws Exception {
        try (PdfReader reader = new PdfReader(bytes)) {
            var extractor = new PdfTextExtractor(reader);
            StringBuilder result = new StringBuilder();
            for (int i = 1; i <= reader.getNumberOfPages(); i++) result.append(extractor.getTextFromPage(i));
            return result.toString();
        }
    }

    @Test void generatesSearchableKoreanPdfWithSubmittedScoresAndItemBonuses() throws Exception {
        when(evaluations.getEvaluationResults(1L)).thenReturn(List.of(team("한글 평가팀", TeamStatus.PASSED, "첫 번째 총평")));
        var file = service.export(1L, false);
        assertThat(file.filename()).isEqualTo("글로벌챌린지_상세평가.pdf");
        assertThat(text(file.bytes())).contains("글로벌챌린지", "한글 평가팀", "김심사", "교육 수료", "특허", "85.0", "90.0", "첫 번째 총평")
                .doesNotContain("임시저장비공개내용");
        Files.createDirectories(Path.of("build/pdf-qa"));
        Files.write(Path.of("build/pdf-qa/details.pdf"), file.bytes());
    }

    @Test void finalPdfContainsOnlyPassedTeamsAndOmitsEvaluatorComments() throws Exception {
        when(evaluations.getEvaluationResults(1L)).thenReturn(List.of(
                team("합격팀", TeamStatus.PASSED, "비공개심사평"), team("불합격팀", TeamStatus.FAILED, "비공개심사평")));
        var file = service.export(1L, true);
        assertThat(text(file.bytes())).contains("최종 합격 결과", "합격팀", "총 1팀", "90.0")
                .doesNotContain("불합격팀", "비공개심사평", "김심사");
        Files.createDirectories(Path.of("build/pdf-qa"));
        Files.write(Path.of("build/pdf-qa/final.pdf"), file.bytes());
    }

    @Test void longCommentsFlowAcrossPagesWithoutLosingTheEnd() throws Exception {
        String comment = "시장 검증과 구체적인 실행 계획을 보완해주세요.\n".repeat(150) + "심사평마지막문장";
        when(evaluations.getEvaluationResults(1L)).thenReturn(List.of(team("긴 심사평 팀", TeamStatus.PENDING, comment)));
        var file = service.export(1L, false);
        try (PdfReader reader = new PdfReader(file.bytes())) {
            assertThat(reader.getNumberOfPages()).isGreaterThan(2);
        }
        assertThat(text(file.bytes())).contains("심사평마지막문장", "두 번째 총평");
        Files.createDirectories(Path.of("build/pdf-qa"));
        Files.write(Path.of("build/pdf-qa/long-comments.pdf"), file.bytes());
    }

    @Test void ranksByUnroundedFinalScoreAndPlacesUnevaluatedTeamsLast() throws Exception {
        var empty = new TeamEvaluationResult(2L, "미평가팀", TeamStatus.PENDING, null, List.of(), List.of());
        var lower = new TeamEvaluationResult(3L, "낮은점수팀", TeamStatus.PENDING, null,
                List.of(evaluation(SubmissionStatus.SUBMITTED, "50", "평가")), List.of());
        when(evaluations.getEvaluationResults(1L)).thenReturn(List.of(empty, lower, team("높은점수팀", TeamStatus.PASSED, "총평")));
        String text = text(service.export(1L, false).bytes());
        assertThat(text.indexOf("높은점수팀")).isLessThan(text.indexOf("낮은점수팀"));
        assertThat(text.indexOf("낮은점수팀")).isLessThan(text.indexOf("미평가팀"));
    }

    @Test void emptyFinalSelectionProducesAValidPdf() throws Exception {
        when(evaluations.getEvaluationResults(1L)).thenReturn(List.of(team("미정팀", TeamStatus.PENDING, "총평")));
        assertThat(text(service.export(1L, true).bytes())).contains("내보낼 결과가 없습니다.", "총 0팀");
    }

    @Test void missingProgramReturns404() {
        assertThatThrownBy(() -> service.export(99L, false)).isInstanceOfSatisfying(ResponseStatusException.class,
                error -> assertThat(error.getStatusCode().value()).isEqualTo(404));
        verifyNoInteractions(evaluations);
    }
}
