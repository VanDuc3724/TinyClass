package com.tinyclass.games;

import com.tinyclass.auth.UserPrincipal;
import com.tinyclass.common.api.*;
import com.tinyclass.common.web.RequestIdFilter;
import com.tinyclass.storage.FileController;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class GameController {
    private final GameCatalogService catalog;
    private final GamePlayService play;
    public GameController(GameCatalogService catalog,GamePlayService play){this.catalog=catalog;this.play=play;}
    @GetMapping("/games") PageResponse<Map<String,Object>> games(@AuthenticationPrincipal UserPrincipal user,@RequestParam(required=false) String q,@RequestParam(required=false) String status,@RequestParam(required=false) String gameType,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return catalog.list(user.id(),q,status,gameType,page,size);}
    @PostMapping("/games") @ResponseStatus(HttpStatus.CREATED) ApiResponse<Map<String,Object>> create(@AuthenticationPrincipal UserPrincipal user,@Valid @RequestBody GameDtos.Save input,HttpServletRequest request){return ApiResponse.of(catalog.save(user.id(),null,input,trace(request)));}
    @GetMapping("/games/{id}") ApiResponse<Map<String,Object>> game(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id){return ApiResponse.of(catalog.game(user.id(),id));}
    @PutMapping("/games/{id}") ApiResponse<Map<String,Object>> edit(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@Valid @RequestBody GameDtos.Save input,HttpServletRequest request){return ApiResponse.of(catalog.save(user.id(),id,input,trace(request)));}
    @PostMapping("/games/{id}/{action:publish|archive|restore}") ApiResponse<Map<String,Object>> action(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@PathVariable String action,@Valid @RequestBody GameDtos.Action input,HttpServletRequest request){return ApiResponse.of(catalog.action(user.id(),id,action,input,trace(request)));}
    @PostMapping("/games/{id}/preview-attempts") ApiResponse<Map<String,Object>> preview(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@Valid @RequestBody GameDtos.Start input,HttpServletRequest request){return ApiResponse.of(play.preview(user.id(),id,input,trace(request)));}
    @GetMapping("/game-assignments") PageResponse<Map<String,Object>> assignments(@AuthenticationPrincipal UserPrincipal user,@RequestParam(required=false) UUID gameId,@RequestParam(required=false) UUID classId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return catalog.assignments(user.id(),gameId,classId,page,size);}
    @PostMapping("/game-assignments") @ResponseStatus(HttpStatus.CREATED) ApiResponse<Map<String,Object>> assign(@AuthenticationPrincipal UserPrincipal user,@Valid @RequestBody GameDtos.Assign input,HttpServletRequest request){return ApiResponse.of(catalog.assign(user.id(),input,trace(request)));}
    @GetMapping("/game-assignments/{id}") ApiResponse<Map<String,Object>> assignment(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id){return ApiResponse.of(catalog.assignment(user.id(),id));}
    @PostMapping("/game-assignments/{id}/revoke") ApiResponse<Map<String,Object>> revoke(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@Valid @RequestBody GameDtos.Action input,HttpServletRequest request){return ApiResponse.of(catalog.revoke(user.id(),id,input,trace(request)));}
    @PostMapping("/game-assignments/{id}/recipients") ApiResponse<Map<String,Object>> grant(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@Valid @RequestBody GameDtos.Grant input,HttpServletRequest request){return ApiResponse.of(catalog.grant(user.id(),id,input,trace(request)));}
    @GetMapping("/game-assignments/{id}/results") PageResponse<Map<String,Object>> results(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return catalog.results(user.id(),id,page,size);}
    @GetMapping("/game-assignments/{id}/students/{child}/results") PageResponse<Map<String,Object>> studentResults(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@PathVariable UUID child,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return catalog.studentResults(user.id(),id,child,page,size);}
    @GetMapping("/family/children/{child}/games") PageResponse<Map<String,Object>> familyGames(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return catalog.familyList(user.id(),child,page,size);}
    @GetMapping("/family/children/{child}/games/collection") ApiResponse<Map<String,Object>> collection(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child){return ApiResponse.of(catalog.collection(user.id(),child));}
    @GetMapping("/family/children/{child}/games/history") PageResponse<Map<String,Object>> history(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return catalog.history(user.id(),child,page,size);}
    @GetMapping("/family/children/{child}/game-assignments/{id}") ApiResponse<Map<String,Object>> familyAssignment(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@PathVariable UUID id){return ApiResponse.of(catalog.familyAssignment(user.id(),child,id));}
    @PostMapping("/family/children/{child}/game-assignments/{id}/attempts") ApiResponse<Map<String,Object>> start(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@PathVariable UUID id,@Valid @RequestBody GameDtos.Start input,HttpServletRequest request){return ApiResponse.of(play.start(user.id(),child,id,input,trace(request)));}
    @GetMapping("/game-attempts/{id}") ApiResponse<Map<String,Object>> attempt(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id){return ApiResponse.of(play.get(user.id(),id));}
    @PostMapping("/game-attempts/{id}/moves") ApiResponse<Map<String,Object>> move(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@Valid @RequestBody GameDtos.Move input,HttpServletRequest request){return ApiResponse.of(play.move(user.id(),id,input,trace(request)));}
    @PostMapping("/game-attempts/{id}/abandon") ApiResponse<Map<String,Object>> abandon(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID id,@Valid @RequestBody GameDtos.Action input,HttpServletRequest request){return ApiResponse.of(play.abandon(user.id(),id,input,trace(request)));}
    @GetMapping("/family/children/{child}/game-assignments/{id}/files/{file}/{action:content|download}") ResponseEntity<Resource> file(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@PathVariable UUID id,@PathVariable UUID file,@PathVariable String action){return FileController.response(catalog.familyFile(user.id(),child,id,file,"download".equals(action)),"download".equals(action));}
    @GetMapping("/family/children/{child}/assignments/{assignment}/games") ApiResponse<List<Map<String,Object>>> linkedAssignment(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@PathVariable UUID assignment){return ApiResponse.of(catalog.linked(user.id(),child,assignment,null));}
    @GetMapping("/family/children/{child}/assignment-items/{item}/games") ApiResponse<List<Map<String,Object>>> linkedItem(@AuthenticationPrincipal UserPrincipal user,@PathVariable UUID child,@PathVariable UUID item){return ApiResponse.of(catalog.linked(user.id(),child,null,item));}
    private static String trace(HttpServletRequest request){return (String)request.getAttribute(RequestIdFilter.ATTRIBUTE);}
}
