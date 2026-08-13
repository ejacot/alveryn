package com.alveryn.api.organization.service;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.*;
import org.springframework.stereotype.Service;
@Slf4j @Service @RequiredArgsConstructor
public class BusinessInvitationEmailService {
 private final JavaMailSender mailSender;
 @Value("${spring.mail.from:${spring.mail.username:}}") private String mailFrom;
 @Value("${alveryn.business.invitation-url:https://alveryn.com}") private String baseUrl;
 public void send(String email,String organization,String language,boolean existingAccount){
  if(mailFrom==null||mailFrom.isBlank()){log.info("Business invitation suppressed because mail sender is not configured");return;}
  var c=copy(language,existingAccount);String link=baseUrl+(existingAccount?"/login":"/register")+"?email="+java.net.URLEncoder.encode(email,java.nio.charset.StandardCharsets.UTF_8);
  try{MimeMessage message=mailSender.createMimeMessage();MimeMessageHelper helper=new MimeMessageHelper(message,true,"UTF-8");if(mailFrom!=null&&!mailFrom.isBlank())helper.setFrom(mailFrom,"Alveryn");helper.setTo(email);helper.setSubject(c[0].formatted(organization));String plain=c[1].formatted(organization)+"\n\n"+link;String html="<html><body style='font-family:Arial;background:#f4f5f3;padding:32px'><div style='max-width:560px;margin:auto;background:white;border-radius:20px;padding:36px'><b style='letter-spacing:3px'>ALVERYN</b><h1>"+escape(c[2])+"</h1><p>"+escape(c[1].formatted(organization))+"</p><p><a style='display:inline-block;background:#10b981;color:#052e22;padding:14px 20px;border-radius:12px;text-decoration:none;font-weight:bold' href='"+link+"'>"+escape(c[3])+"</a></p></div></body></html>";helper.setText(plain,html);mailSender.send(message);}catch(Exception ex){log.warn("Business invitation delivery failed for {}",email);}
 }
 private String[] copy(String language,boolean existing){return switch(language==null?"en":language){case"ro"->new String[]{"Invitație în %s","Ai fost adăugat în echipa %s. Programul tău va apărea în Alveryn.","Ai fost invitat în Alveryn",existing?"Autentifică-te":"Creează contul"};case"de"->new String[]{"Einladung zu %s","Du wurdest zum Team %s hinzugefügt. Dein Dienstplan erscheint in Alveryn.","Du wurdest zu Alveryn eingeladen",existing?"Anmelden":"Konto erstellen"};case"ru"->new String[]{"Приглашение в %s","Вы добавлены в команду %s. Ваш график появится в Alveryn.","Вас пригласили в Alveryn",existing?"Войти":"Создать аккаунт"};default->new String[]{"Invitation to %s","You were added to the %s team. Your schedule will appear in Alveryn.","You were invited to Alveryn",existing?"Sign in":"Create account"};};}
 private String escape(String value){return value.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;");}
}
