package com.example.evalhub;

import com.example.evalhub.dto.AttachmentBatchResponse;
import com.example.evalhub.entity.Role;
import com.example.evalhub.entity.User;
import com.example.evalhub.repository.UserRepository;
import com.example.evalhub.security.AuthenticatedUser;
import com.example.evalhub.service.ParticipantAttachmentService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AttachmentBatchApiIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @MockitoBean ParticipantAttachmentService attachments;

    private UsernamePasswordAuthenticationToken authenticated(Role role) {
        var user = users.save(new User(UUID.randomUUID() + "@example.com", "encoded", role));
        return new UsernamePasswordAuthenticationToken(AuthenticatedUser.from(user), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role.name())));
    }

    @ParameterizedTest
    @EnumSource(value = Role.class, names = {"MEMBER", "MANAGER", "SUPER_ADMIN"})
    void acceptsRepeatedFilesPartsInOneAuthenticatedRequest(Role role) throws Exception {
        when(attachments.uploadBatch(eq(1L), anyList(), any())).thenAnswer(invocation -> {
            List<org.springframework.web.multipart.MultipartFile> files = invocation.getArgument(1);
            assertThat(files).extracting(org.springframework.web.multipart.MultipartFile::getOriginalFilename)
                    .containsExactly("a.pdf", "b.pdf");
            return new AttachmentBatchResponse(List.of(), List.of(new AttachmentBatchResponse.Failure("b.pdf", "test failure")));
        });
        mvc.perform(multipart("/api/teams/1/attachments/batch")
                        .file(new MockMultipartFile("files", "a.pdf", "application/pdf", "%PDF".getBytes()))
                        .file(new MockMultipartFile("files", "b.pdf", "application/pdf", "%PDF".getBytes()))
                        .with(authentication(authenticated(role))).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.uploaded").isArray())
                .andExpect(jsonPath("$.failed[0].name").value("b.pdf"));
        verify(attachments).uploadBatch(eq(1L), anyList(), any());
    }

    @Test
    void evaluatorsCannotUploadBatches() throws Exception {
        mvc.perform(multipart("/api/teams/1/attachments/batch")
                        .file(new MockMultipartFile("files", "a.pdf", "application/pdf", "%PDF".getBytes()))
                        .with(authentication(authenticated(Role.EVALUATOR))).with(csrf()))
                .andExpect(status().isForbidden());
        verifyNoInteractions(attachments);
    }
}
